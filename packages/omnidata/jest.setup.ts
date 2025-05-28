// Jest setup file
// Add any global test setup here if needed

// Polyfill TextDecoder and TextEncoder for Node.js test environment
import { TextDecoder, TextEncoder } from 'util';

global.TextDecoder = TextDecoder as any;
global.TextEncoder = TextEncoder as any;

// Polyfill File API for tests
global.File = class File {
    constructor(public chunks: any[], public name: string, public options: any = {}) {}
    
    get type() {
        return this.options.type || '';
    }
    
    get size() {
        return this.chunks.reduce((size, chunk) => size + chunk.byteLength, 0);
    }
} as any;

global.FileReader = class FileReader {
    result: any = null;
    error: any = null;
    onload: ((event: any) => void) | null = null;
    onerror: ((event: any) => void) | null = null;
    
    readAsArrayBuffer(file: any) {
        setTimeout(() => {
            try {
                // Combine chunks into a single ArrayBuffer
                const totalSize = file.chunks.reduce((size: number, chunk: any) => size + chunk.byteLength, 0);
                const result = new ArrayBuffer(totalSize);
                const view = new Uint8Array(result);
                let offset = 0;
                
                for (const chunk of file.chunks) {
                    if (chunk instanceof ArrayBuffer) {
                        view.set(new Uint8Array(chunk), offset);
                        offset += chunk.byteLength;
                    }
                }
                
                this.result = result;
                if (this.onload) {
                    this.onload({ target: this });
                }
            } catch (error) {
                this.error = error;
                if (this.onerror) {
                    this.onerror({ target: this });
                }
            }
        }, 0);
    }
} as any; 