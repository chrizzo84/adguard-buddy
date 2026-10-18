import { hoursToDays, sumAlignedAtEnd } from '../series';

describe('hoursToDays', () => {
  it('groups 24 hourly buckets per day, newest last', () => {
    const hourly = [...new Array(24).fill(1), ...new Array(24).fill(2)];
    expect(hoursToDays(hourly)).toEqual([24, 48]);
  });

  it('leaves the oldest day partial', () => {
    expect(hoursToDays([5, ...new Array(24).fill(1)])).toEqual([5, 24]);
  });

  it('returns nothing for an empty series', () => {
    expect(hoursToDays([])).toEqual([]);
  });
});

describe('sumAlignedAtEnd', () => {
  it('aligns series of different lengths at the newest bucket', () => {
    expect(sumAlignedAtEnd([[1, 2, 3], [10, 20]])).toEqual([1, 12, 23]);
  });

  it('returns nothing when there are no series', () => {
    expect(sumAlignedAtEnd([])).toEqual([]);
  });
});
