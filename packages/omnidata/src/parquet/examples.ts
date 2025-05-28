import {
    parseParquet,
    parseParquetSimple,
    parseParquetStream,
    createParquetParser,
    ParquetDataType,
    ParquetCompression,
    ParquetEncoding,
} from './index';

// Example 1: Simple parsing from ArrayBuffer
export async function basicParquetParsing() {
    // Create a mock parquet file buffer (in real usage, this would come from a file)
    const buffer = createMockParquetBuffer();
    
    try {
        const result = await parseParquetSimple(buffer);
        
        console.log('Schema:', result.schema);
        console.log('Number of rows:', result.rows.length);
        console.log('Errors:', result.errors);
        
        // Access the data
        result.rows.forEach((row, index) => {
            console.log(`Row ${index}:`, row);
        });
        
        return result;
    } catch (error) {
        console.error('Failed to parse parquet:', error);
        throw error;
    }
}

// Example 2: Streaming parsing with callbacks
export async function streamingParquetParsing() {
    const buffer = createMockParquetBuffer();
    const file = new File([buffer], 'example.parquet', { type: 'application/octet-stream' });
    
    const rows: any[] = [];
    let schema: any = null;
    
    await parseParquetStream(
        file,
        {
            onSchema: (s) => {
                schema = s;
                console.log('Schema received:', s);
            },
            onRow: (row, index) => {
                rows.push(row);
                console.log(`Row ${index}:`, row);
            },
            onError: (error) => {
                console.error('Parse error:', error);
            },
            onEnd: (result) => {
                console.log(`Parsing complete. Total rows: ${result.totalRows}, Errors: ${result.errors.length}`);
            }
        }
    );
    
    return { schema, rows };
}

// Example 3: Using the unified parseParquet API
export async function unifiedParquetParsing() {
    const buffer = createMockParquetBuffer();
    
    // Non-streaming mode
    console.log('=== Non-streaming mode ===');
    const result = await parseParquet(buffer);
    if (result) {
        console.log('Schema:', result.schema);
        console.log('Rows:', result.rows.length);
    }
    
    // Streaming mode (auto-detected)
    console.log('\n=== Streaming mode ===');
    await parseParquet(buffer, {
        onSchema: (schema) => console.log('Schema:', schema.columns.length, 'columns'),
        onRow: (row, index) => console.log(`Row ${index}:`, Object.keys(row).length, 'fields'),
        onEnd: (result) => console.log('Done:', result.totalRows, 'rows')
    });
}

// Example 4: Advanced parser usage with custom options
export async function advancedParquetParsing() {
    const buffer = createMockParquetBuffer();
    
    // Create parser with custom options
    const parser = createParquetParser({
        chunkSize: 4096,
        encoding: 'utf-8'
    });
    
    // Parse with the custom parser
    const result = parser.parse(buffer);
    
    console.log('=== Advanced Parsing Results ===');
    console.log('Schema version:', result.schema.version);
    console.log('Number of columns:', result.schema.columns.length);
    console.log('Column details:');
    
    result.schema.columns.forEach((col, index) => {
        console.log(`  ${index + 1}. ${col.name} (${ParquetDataType[col.type]})`);
        console.log(`     Logical Type: ${col.logicalType || 'None'}`);
        console.log(`     Repetition: ${col.repetitionType || 'REQUIRED'}`);
        console.log(`     Encoding: ${col.encoding || 'PLAIN'}`);
        console.log(`     Compression: ${col.compression || 'UNCOMPRESSED'}`);
    });
    
    console.log('\nData preview:');
    result.rows.slice(0, 5).forEach((row, index) => {
        console.log(`Row ${index}:`, row);
    });
    
    if (result.errors.length > 0) {
        console.log('\nErrors encountered:');
        result.errors.forEach((error, index) => {
            console.log(`  ${index + 1}. Offset ${error.offset}: ${error.message}`);
        });
    }
    
    return result;
}

// Example 5: Error handling and validation
export async function parquetErrorHandling() {
    console.log('=== Testing Error Handling ===');
    
    // Test with invalid buffer
    const invalidBuffer = new ArrayBuffer(100);
    const invalidView = new Uint8Array(invalidBuffer);
    invalidView[0] = 0x49; // Invalid magic number
    invalidView[1] = 0x4E;
    invalidView[2] = 0x56;
    invalidView[3] = 0x41;
    
    try {
        const result = await parseParquetSimple(invalidBuffer);
        console.log('Invalid file errors:', result.errors.length);
        result.errors.forEach(error => {
            console.log(`  - ${error.message}`);
        });
    } catch (error) {
        console.error('Exception caught:', error);
    }
    
    // Test with empty buffer
    try {
        const emptyResult = await parseParquetSimple(new ArrayBuffer(0));
        console.log('Empty file errors:', emptyResult.errors.length);
    } catch (error) {
        console.error('Empty file exception:', error);
    }
}

// Example 6: Working with File objects (browser environment)
export async function browserFileHandling() {
    // Simulate file input from user
    const buffer = createMockParquetBuffer();
    const file = new File([buffer], 'data.parquet', { 
        type: 'application/octet-stream',
        lastModified: Date.now()
    });
    
    console.log('=== Browser File Handling ===');
    console.log('File name:', file.name);
    console.log('File size:', file.size, 'bytes');
    console.log('File type:', file.type);
    
    // Parse the file
    const result = await parseParquet(file);
    if (result) {
        console.log('Successfully parsed file with', result.rows.length, 'rows');
        return result;
    }
}

// Example 7: Comparing different parsing approaches
export async function compareParsingApproaches() {
    const buffer = createMockParquetBuffer();
    
    console.log('=== Comparing Parsing Approaches ===');
    
    // Approach 1: Simple parsing
    console.time('Simple parsing');
    const simpleResult = await parseParquetSimple(buffer);
    console.timeEnd('Simple parsing');
    console.log('Simple result:', simpleResult.rows.length, 'rows');
    
    // Approach 2: Streaming parsing
    console.time('Streaming parsing');
    let streamRowCount = 0;
    await parseParquet(buffer, {
        onRow: () => streamRowCount++,
        onEnd: () => console.log('Streaming result:', streamRowCount, 'rows')
    });
    console.timeEnd('Streaming parsing');
    
    // Approach 3: Direct parser usage
    console.time('Direct parser');
    const parser = createParquetParser();
    const directResult = parser.parse(buffer);
    console.timeEnd('Direct parser');
    console.log('Direct result:', directResult.rows.length, 'rows');
}

// Helper function to create a mock parquet buffer for examples
function createMockParquetBuffer(): ArrayBuffer {
    const buffer = new ArrayBuffer(1024);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);
    
    // Write "PAR1" magic number at the beginning
    uint8View[0] = 0x50; // 'P'
    uint8View[1] = 0x41; // 'A'
    uint8View[2] = 0x52; // 'R'
    uint8View[3] = 0x31; // '1'
    
    // Write footer length (4 bytes) at position buffer.length - 8
    view.setUint32(buffer.byteLength - 8, 100, true); // 100 bytes footer
    
    // Write "PAR1" magic number at the end
    uint8View[buffer.byteLength - 4] = 0x50; // 'P'
    uint8View[buffer.byteLength - 3] = 0x41; // 'A'
    uint8View[buffer.byteLength - 2] = 0x52; // 'R'
    uint8View[buffer.byteLength - 1] = 0x31; // '1'
    
    // Add some mock footer data
    const footerStart = buffer.byteLength - 8 - 100;
    for (let i = 0; i < 100; i++) {
        uint8View[footerStart + i] = i % 256;
    }
    
    return buffer;
}

// Example usage function that runs all examples
export async function runAllParquetExamples() {
    console.log('🚀 Running Parquet Parser Examples\n');
    
    try {
        console.log('1. Basic Parsing:');
        await basicParquetParsing();
        console.log('\n' + '='.repeat(50) + '\n');
        
        console.log('2. Streaming Parsing:');
        await streamingParquetParsing();
        console.log('\n' + '='.repeat(50) + '\n');
        
        console.log('3. Unified API:');
        await unifiedParquetParsing();
        console.log('\n' + '='.repeat(50) + '\n');
        
        console.log('4. Advanced Usage:');
        await advancedParquetParsing();
        console.log('\n' + '='.repeat(50) + '\n');
        
        console.log('5. Error Handling:');
        await parquetErrorHandling();
        console.log('\n' + '='.repeat(50) + '\n');
        
        console.log('6. Browser File Handling:');
        await browserFileHandling();
        console.log('\n' + '='.repeat(50) + '\n');
        
        console.log('7. Performance Comparison:');
        await compareParsingApproaches();
        
        console.log('\n✅ All examples completed successfully!');
    } catch (error) {
        console.error('❌ Example failed:', error);
    }
}

// Export all examples for easy access
export const parquetExamples = {
    basic: basicParquetParsing,
    streaming: streamingParquetParsing,
    unified: unifiedParquetParsing,
    advanced: advancedParquetParsing,
    errorHandling: parquetErrorHandling,
    browserFiles: browserFileHandling,
    performance: compareParsingApproaches,
    runAll: runAllParquetExamples
}; 