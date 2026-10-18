
import { NextResponse } from "next/server";
import logger from "../../logger";
import { httpRequest } from "@/lib/httpRequest";
import {
    authHeaders,
    buildBaseUrl,
    resolveAllConnections,
    type ResolvedConnection,
} from "@/lib/serverConnections";
import { hoursToDays, sumAlignedAtEnd } from "./series";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Types

type TopArrayEntry = { [key: string]: number };

type StatsData = {
    avg_processing_time: number;
    dns_queries: number;
    num_dns_queries?: number;
    num_blocked_filtering: number;
    num_replaced_safebrowsing: number;
    num_replaced_parental: number;
    // Time series from the AdGuard API, in buckets of `time_units`
    dns_queries_arr?: number[];
    blocked_filtering_arr?: number[];
    replaced_safebrowsing_arr?: number[];
    replaced_parental_arr?: number[];
    time_units?: string;
    top_queried_domains: TopArrayEntry[];
    top_blocked_domains: TopArrayEntry[];
    top_clients: TopArrayEntry[];
    top_upstreams_avg_time: TopArrayEntry[];
    top_upstreams_responses: TopArrayEntry[];
};

async function fetchStatsForServer(connection: ResolvedConnection): Promise<StatsData | null> {
    try {
        const base = buildBaseUrl(connection);
        const statsUrl = `${base}/control/stats`;
        const r = await httpRequest({
            method: 'GET',
            url: statsUrl,
            headers: authHeaders(connection),
            allowInsecure: connection.allowInsecure,
        });
        if (r.statusCode < 200 || r.statusCode >= 300) {
            logger.warn(`Failed to fetch stats from ${connection.ip || connection.url || 'unknown'}: ${r.statusCode}`);
            return null;
        }
        const data = JSON.parse(r.body || '{}');
        // AdGuard API returns some fields with num_ prefix, we need to align them with our StatsData type
        // Also, dns_queries can be an array (hourly data) - we need to handle both
        const dnsQueriesArr = Array.isArray(data.dns_queries) ? data.dns_queries : [];
        const blockedArr = Array.isArray(data.blocked_filtering) ? data.blocked_filtering : [];
        const safebrowsingArr = Array.isArray(data.replaced_safebrowsing) ? data.replaced_safebrowsing : [];
        const parentalArr = Array.isArray(data.replaced_parental) ? data.replaced_parental : [];

        return {
            ...data,
            dns_queries: data.num_dns_queries || 0,
            num_blocked_filtering: data.num_blocked_filtering || 0,
            num_replaced_safebrowsing: data.num_replaced_safebrowsing || 0,
            num_replaced_parental: data.num_replaced_parental || 0,
            dns_queries_arr: dnsQueriesArr,
            blocked_filtering_arr: blockedArr,
            replaced_safebrowsing_arr: safebrowsingArr,
            replaced_parental_arr: parentalArr,
            time_units: data.time_units || 'hours',
        };
    } catch (error) {
        logger.error(`Error fetching stats from ${connection.url || connection.ip}: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    }
}

type SeriesKey = 'dns_queries_arr' | 'blocked_filtering_arr' | 'replaced_safebrowsing_arr' | 'replaced_parental_arr';

function aggregateStats(statsList: StatsData[]): StatsData {
    const combined: StatsData = {
        avg_processing_time: 0,
        dns_queries: 0,
        num_blocked_filtering: 0,
        num_replaced_safebrowsing: 0,
        num_replaced_parental: 0,
        dns_queries_arr: [],
        blocked_filtering_arr: [],
        replaced_safebrowsing_arr: [],
        replaced_parental_arr: [],
        time_units: 'hours',
        top_queried_domains: [],
        top_blocked_domains: [],
        top_clients: [],
        top_upstreams_avg_time: [],
        top_upstreams_responses: [],
    };

    const totalDnsQueries = statsList.reduce((sum, stats) => sum + (stats.dns_queries || 0), 0);
    combined.dns_queries = totalDnsQueries;

    // Sum up blocking/threat counts
    combined.num_blocked_filtering = statsList.reduce((sum, stats) => sum + (stats.num_blocked_filtering || 0), 0);
    combined.num_replaced_safebrowsing = statsList.reduce((sum, stats) => sum + (stats.num_replaced_safebrowsing || 0), 0);
    combined.num_replaced_parental = statsList.reduce((sum, stats) => sum + (stats.num_replaced_parental || 0), 0);

    // AdGuard Home reports hourly buckets for a 24h retention and daily ones
    // for anything longer. When servers disagree, hourly series are rolled up
    // into days so that every bucket covers the same span before summing.
    const unit = statsList.some(stats => stats.time_units === 'days') ? 'days' : 'hours';
    combined.time_units = unit;

    const aggregateSeries = (key: SeriesKey): number[] =>
        sumAlignedAtEnd(statsList.map(stats => {
            const arr = stats[key] || [];
            return unit === 'days' && stats.time_units !== 'days' ? hoursToDays(arr) : arr;
        }));

    combined.dns_queries_arr = aggregateSeries('dns_queries_arr');
    combined.blocked_filtering_arr = aggregateSeries('blocked_filtering_arr');
    combined.replaced_safebrowsing_arr = aggregateSeries('replaced_safebrowsing_arr');
    combined.replaced_parental_arr = aggregateSeries('replaced_parental_arr');

    // Weighted average for processing time
    if (totalDnsQueries > 0) {
        const totalProcessingTime = statsList.reduce((sum, stats) => sum + (stats.avg_processing_time * (stats.dns_queries || 0)), 0);
        combined.avg_processing_time = totalProcessingTime / totalDnsQueries;
    }

    const aggregateTopList = (listName: keyof Pick<StatsData, 'top_queried_domains' | 'top_blocked_domains' | 'top_clients' | 'top_upstreams_responses' | 'top_upstreams_avg_time'>) => {
        const map = new Map<string, number>();
        for (const stats of statsList) {
            const list = stats[listName] as TopArrayEntry[] | undefined;
            if (list) {
                for (const entry of list) {
                    const [key, value] = Object.entries(entry)[0];
                    map.set(key, (map.get(key) || 0) + value);
                }
            }
        }
        return Array.from(map.entries())
            .sort((a, b) => b[1] - a[1])
            .map(([key, value]) => ({ [key]: value }));
    };

    // For avg_time upstreams, we need to calculate the weighted average
    const aggregateTopListAvg = (listName: keyof Pick<StatsData, 'top_upstreams_avg_time'>) => {
        const timeMap = new Map<string, { totalTime: number, count: number }>();
        const responseMap = new Map<string, number>();

        // First, get total responses for each upstream
        for (const stats of statsList) {
            const responses = stats.top_upstreams_responses as TopArrayEntry[] | undefined;
            if (responses) {
                for (const entry of responses) {
                    const [key, value] = Object.entries(entry)[0];
                    responseMap.set(key, (responseMap.get(key) || 0) + value);
                }
            }
        }

        // Then, calculate weighted average for avg_time
        for (const stats of statsList) {
            const avgTimes = stats[listName] as TopArrayEntry[] | undefined;
            const responses = stats.top_upstreams_responses as TopArrayEntry[] | undefined;
            if (avgTimes && responses) {
                const statResponseMap = new Map(responses.flatMap(e => Object.entries(e)));
                for (const entry of avgTimes) {
                    const [key, avgTime] = Object.entries(entry)[0];
                    const responseCount = statResponseMap.get(key) || 0;
                    const current = timeMap.get(key) || { totalTime: 0, count: 0 };
                    timeMap.set(key, {
                        totalTime: current.totalTime + (avgTime * responseCount),
                        count: current.count + responseCount,
                    });
                }
            }
        }

        return Array.from(timeMap.entries())
            .map(([key, { totalTime, count }]) => ({ [key]: count > 0 ? totalTime / count : 0 }))
            .sort((a, b) => Object.values(b)[0] - Object.values(a)[0]);
    };


    combined.top_queried_domains = aggregateTopList('top_queried_domains');
    combined.top_blocked_domains = aggregateTopList('top_blocked_domains');
    combined.top_clients = aggregateTopList('top_clients');
    combined.top_upstreams_responses = aggregateTopList('top_upstreams_responses');
    combined.top_upstreams_avg_time = aggregateTopListAvg('top_upstreams_avg_time');


    return combined;
}

export async function GET() {
    logger.info("GET /statistics/combined called");
    try {
        const connections = await resolveAllConnections();
        if (connections.length === 0) {
            return NextResponse.json({ message: "No connections configured." }, { status: 404 });
        }

        const allStatsPromises = connections.map(fetchStatsForServer);
        const allStatsResults = await Promise.all(allStatsPromises);
        const validStats = allStatsResults.filter((s): s is StatsData => s !== null);

        if (validStats.length === 0) {
            return NextResponse.json({ message: "Could not fetch stats from any server." }, { status: 502 });
        }

        const combinedStats = aggregateStats(validStats);
        logger.info("Successfully fetched and combined statistics.");
        return NextResponse.json(combinedStats);

    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        logger.error(`Internal server error in /statistics/combined: ${errorMessage}`);
        return new NextResponse(
            JSON.stringify({ message: `Internal server error: ${errorMessage}` }),
            { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
    }
}
