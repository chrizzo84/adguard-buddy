import { NextResponse } from 'next/server';
import CryptoJS from 'crypto-js';
import { promises as fs } from 'fs';
import path from 'path';

/**
 * DEBUG ENDPOINT: Test password decryption
 * This helps debug why auto-sync gets 401 errors
 */
export async function GET() {
  try {
    const dataFilePath = path.join(process.cwd(), '.data', 'connections.json');
    const fileContent = await fs.readFile(dataFilePath, 'utf-8');
    const data = JSON.parse(fileContent);
    
    // Try both encryption keys
    const key1 = process.env.ADGUARD_BUDDY_ENCRYPTION_KEY || 'NOT_SET';
    const key2 = process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY || 'NOT_SET';
    const key3 = "adguard-buddy-key";
    
    interface ConnectionData {
      url?: string;
      ip?: string;
      port?: number;
      password: string;
      username?: string;
    }
    
    const results = data.connections.map((conn: ConnectionData, index: number) => {
      const connId = conn.url || `${conn.ip}:${conn.port}`;
      const encryptedPassword = conn.password;
      
      let decrypted1 = '';
      let decrypted2 = '';
      let decrypted3 = '';
      
      try {
        const bytes1 = CryptoJS.AES.decrypt(encryptedPassword, key1);
        decrypted1 = bytes1.toString(CryptoJS.enc.Utf8);
      } catch (e) {
        decrypted1 = `ERROR: ${e}`;
      }
      
      try {
        const bytes2 = CryptoJS.AES.decrypt(encryptedPassword, key2);
        decrypted2 = bytes2.toString(CryptoJS.enc.Utf8);
      } catch (e) {
        decrypted2 = `ERROR: ${e}`;
      }
      
      try {
        const bytes3 = CryptoJS.AES.decrypt(encryptedPassword, key3);
        decrypted3 = bytes3.toString(CryptoJS.enc.Utf8);
      } catch (e) {
        decrypted3 = `ERROR: ${e}`;
      }
      
      return {
        index,
        connectionId: connId,
        username: conn.username,
        encryptedPasswordLength: encryptedPassword?.length || 0,
        encryptedPasswordPreview: encryptedPassword?.substring(0, 20) + '...',
        decryptionResults: {
          withADGUARD_BUDDY_ENCRYPTION_KEY: {
            keySource: 'process.env.ADGUARD_BUDDY_ENCRYPTION_KEY',
            keyAvailable: key1 !== 'NOT_SET',
            keyPreview: key1 !== 'NOT_SET' ? key1.substring(0, 5) + '...' : 'NOT_SET',
            decryptedLength: decrypted1.length,
            success: decrypted1.length > 0 && !decrypted1.startsWith('ERROR'),
            passwordPreview: decrypted1.length > 0 && !decrypted1.startsWith('ERROR') 
              ? '***' + decrypted1.substring(3, 6) + '***' 
              : decrypted1.substring(0, 50)
          },
          withNEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY: {
            keySource: 'process.env.NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY',
            keyAvailable: key2 !== 'NOT_SET',
            keyPreview: key2 !== 'NOT_SET' ? key2.substring(0, 5) + '...' : 'NOT_SET',
            decryptedLength: decrypted2.length,
            success: decrypted2.length > 0 && !decrypted2.startsWith('ERROR'),
            passwordPreview: decrypted2.length > 0 && !decrypted2.startsWith('ERROR') 
              ? '***' + decrypted2.substring(3, 6) + '***' 
              : decrypted2.substring(0, 50)
          },
          withDefaultKey: {
            keySource: 'default "adguard-buddy-key"',
            keyAvailable: true,
            keyPreview: 'adgua...',
            decryptedLength: decrypted3.length,
            success: decrypted3.length > 0 && !decrypted3.startsWith('ERROR'),
            passwordPreview: decrypted3.length > 0 && !decrypted3.startsWith('ERROR') 
              ? '***' + decrypted3.substring(3, 6) + '***' 
              : decrypted3.substring(0, 50)
          }
        }
      };
    });
    
    return NextResponse.json({
      message: 'Password decryption test results',
      masterServerIp: data.masterServerIp,
      totalConnections: data.connections.length,
      environmentVariables: {
        ADGUARD_BUDDY_ENCRYPTION_KEY: key1 !== 'NOT_SET' ? 'SET (' + key1.substring(0, 5) + '...)' : 'NOT_SET',
        NEXT_PUBLIC_ADGUARD_BUDDY_ENCRYPTION_KEY: key2 !== 'NOT_SET' ? 'SET (' + key2.substring(0, 5) + '...)' : 'NOT_SET',
      },
      results
    });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json({ 
      error: 'Failed to test decryption', 
      message: err.message,
      stack: err.stack 
    }, { status: 500 });
  }
}
