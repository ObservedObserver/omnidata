import {
    CSVParser,
    parseCSVFile,
    parseCSVFileStream,
    parseCSVFromPath,
    parseCSVFromPathStream,
    createCSVParser,
    parseCSV,
    parseCSVSimple,
    parseCSVStream,
    type CSVParseOptions,
    type CSVStreamOptions,
} from "./index";

// ========================================
// NEW SIMPLIFIED APIs - RECOMMENDED
// ========================================

// Example 1: Super simple API - just parse and get results
export async function simplestExample() {
    const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles
Bob,35,Chicago`;

    // Simplest possible usage - headers auto-detected
    const result = await parseCSVSimple(csvData);
    console.log("Parsed data:", result.rows);

    // With custom delimiter
    const tsvData = `name\tage\tcity
John\t25\tNew York`;
    const tsvResult = await parseCSVSimple(tsvData, { delimiter: "\t" });
    console.log("TSV data:", tsvResult.rows);
}

// Example 2: Simple file parsing (browser or Node.js)
export async function simpleFileExample(fileOrPath: File | string) {
    // Works with both browser File objects and Node.js file paths
    const result = await parseCSVSimple(fileOrPath, {
        headers: true,
        delimiter: ",",
    });

    console.log(`Parsed ${result.rows.length} rows`);
    console.log("First row:", result.rows[0]);

    if (result.errors.length > 0) {
        console.log("Errors found:", result.errors);
    }

    return result;
}

// Example 3: Unified API - auto-detects streaming vs non-streaming
export async function unifiedAPIExample(input: string | File | string) {
    // Non-streaming mode (returns all data)
    const result = await parseCSV(input, {
        headers: true,
        delimiter: ",",
        skipEmptyLines: true,
    });

    if (result) {
        console.log("All data loaded:", result.rows);
        return result;
    }
}

// Example 4: Unified API with streaming (auto-detected by callbacks)
export async function unifiedStreamingExample(input: File | string) {
    let rowCount = 0;

    // Streaming mode auto-detected because onRow callback is provided
    await parseCSV(input, {
        headers: true,
        onHeaders: (headers) => {
            console.log("Headers:", headers);
        },
        onRow: (row, index) => {
            rowCount++;
            console.log(`Row ${index}:`, row);

            // Process each row immediately
            if (rowCount % 1000 === 0) {
                console.log(`Processed ${rowCount} rows so far...`);
            }
        },
        onEnd: (result) => {
            console.log(`Finished! Total: ${result.totalRows} rows`);
        },
    });
}

// Example 5: Explicit streaming API for large files
export async function explicitStreamingExample(input: File | string) {
    const processedRows: any[] = [];

    await parseCSVStream(
        input,
        {
            onHeaders: (headers) => {
                console.log("File headers:", headers);
            },
            onRow: (row, index) => {
                // Process row immediately to save memory
                processedRows.push(processRow(row));

                // Clear processed rows periodically to save memory
                if (processedRows.length >= 1000) {
                    saveBatch(processedRows);
                    processedRows.length = 0; // Clear array
                }
            },
            onError: (error) => {
                console.error(
                    `Parse error at line ${error.line}:`,
                    error.message
                );
            },
            onEnd: (result) => {
                // Save remaining rows
                if (processedRows.length > 0) {
                    saveBatch(processedRows);
                }
                console.log(
                    `Processing complete! Total rows: ${result.totalRows}`
                );
            },
        },
        {
            headers: true,
            chunkSize: 16384, // 16KB chunks for better performance
            skipEmptyLines: true,
        }
    );
}

function processRow(row: any) {
    // Example processing: convert age to number, normalize city names
    if (typeof row === "object" && row.age) {
        return {
            ...row,
            age: parseInt(row.age, 10),
            city: row.city?.trim().toUpperCase(),
        };
    }
    return row;
}

function saveBatch(rows: any[]) {
    // Example: save to database, send to API, etc.
    console.log(`Saving batch of ${rows.length} processed rows`);
}

// ========================================
// COMPARISON: When to use which API
// ========================================

export async function apiComparisonExample() {
    const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles`;

    // 1. SIMPLEST - for basic use cases
    console.log("=== parseCSVSimple ===");
    const simple = await parseCSVSimple(csvData);
    console.log(simple.rows);

    // 2. UNIFIED - for more control, auto-detects streaming
    console.log("=== parseCSV (non-streaming) ===");
    const unified = await parseCSV(csvData, { headers: true });
    if (unified) console.log(unified.rows);

    // 3. UNIFIED STREAMING - auto-detected by callbacks
    console.log("=== parseCSV (streaming) ===");
    await parseCSV(csvData, {
        headers: true,
        onRow: (row, index) => console.log(`Streaming row ${index}:`, row),
    });

    // 4. EXPLICIT STREAMING - for large files
    console.log("=== parseCSVStream ===");
    await parseCSVStream(
        csvData as any,
        {
            onRow: (row, index) =>
                console.log(`Explicit streaming row ${index}:`, row),
        },
        { headers: true }
    );
}

// ========================================
// ORIGINAL EXAMPLES (still available)
// ========================================

// Example 1: Basic string parsing
export function basicStringParsing() {
    const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles
Bob,35,Chicago`;

    const parser = createCSVParser({ headers: true });
    const result = parser.parse(csvData);

    console.log("Headers:", result.headers);
    console.log("Rows:", result.rows);
    console.log("Errors:", result.errors);
}

// Example 2: Custom delimiter and options
export function customDelimiterParsing() {
    const csvData = `name;age;city
"John Doe";25;"New York"
"Jane Smith";30;"Los Angeles"`;

    const parser = createCSVParser({
        delimiter: ";",
        headers: true,
        quote: '"',
    });

    const result = parser.parse(csvData);
    console.log("Custom delimiter result:", result.rows);
}

// Example 3: Browser File API usage
export async function browserFileExample(file: File) {
    try {
        // For small files - load all at once
        const result = await parseCSVFile(file, {
            headers: true,
            skipEmptyLines: true,
        });

        console.log("File parsed:", result);
        return result;
    } catch (error) {
        console.error("Error parsing file:", error);
        throw error;
    }
}

// Example 4: Browser streaming for large files
export async function browserStreamingExample(file: File) {
    const rows: any[] = [];
    let headers: string[] = [];

    try {
        await parseCSVFileStream(file, {
            headers: true,
            onHeaders: (h) => {
                headers = h;
                console.log("Headers received:", h);
            },
            onRow: (row, index) => {
                rows.push(row);
                if (index % 1000 === 0) {
                    console.log(`Processed ${index} rows`);
                }
            },
            onError: (error) => {
                console.error("Parse error:", error);
            },
            onEnd: (result) => {
                console.log(`Finished processing ${result.totalRows} rows`);
                console.log(`Errors: ${result.errors.length}`);
            },
        });

        return { headers, rows };
    } catch (error) {
        console.error("Streaming error:", error);
        throw error;
    }
}

// Example 5: Node.js file parsing
export async function nodeFileExample(filePath: string) {
    try {
        const result = await parseCSVFromPath(filePath, {
            headers: true,
            encoding: "utf-8",
        });

        console.log(`Parsed ${result.rows.length} rows from ${filePath}`);
        return result;
    } catch (error) {
        console.error("Error parsing Node.js file:", error);
        throw error;
    }
}

// Example 6: Node.js streaming for large files
export async function nodeStreamingExample(filePath: string) {
    const rows: any[] = [];
    let totalRows = 0;

    try {
        await parseCSVFromPathStream(filePath, {
            headers: true,
            chunkSize: 16384, // 16KB chunks
            onHeaders: (headers) => {
                console.log("File headers:", headers);
            },
            onRow: (row, index) => {
                rows.push(row);
                totalRows++;

                // Log progress every 10,000 rows
                if (totalRows % 10000 === 0) {
                    console.log(`Processed ${totalRows} rows...`);
                }
            },
            onError: (error) => {
                console.error(`Error at line ${error.line}:`, error.message);
            },
            onEnd: (result) => {
                console.log(`Completed! Total rows: ${result.totalRows}`);
                if (result.errors.length > 0) {
                    console.log(`Errors encountered: ${result.errors.length}`);
                }
            },
        });

        return rows;
    } catch (error) {
        console.error("Node.js streaming error:", error);
        throw error;
    }
}

// Example 7: Advanced parsing with error handling
export function advancedParsingExample() {
    const problematicCSV = `name,age,city
John,25,New York
"Jane,30,"Los Angeles"
Bob,35,Chicago
"Alice","25","Boston`;

    const parser = createCSVParser({
        headers: true,
        skipEmptyLines: true,
    });

    const result = parser.parse(problematicCSV);

    console.log("Parsed rows:", result.rows);
    console.log("Parsing errors:", result.errors);

    // Handle errors gracefully
    if (result.errors.length > 0) {
        console.log("Found parsing errors:");
        result.errors.forEach((error) => {
            console.log(
                `Line ${error.line}, Column ${error.column}: ${error.message}`
            );
        });
    }

    return result;
}

// Example 8: Memory-efficient processing for very large files
export async function memoryEfficientProcessing(filePath: string) {
    let processedCount = 0;
    const batchSize = 1000;
    let currentBatch: any[] = [];

    await parseCSVFromPathStream(filePath, {
        headers: true,
        chunkSize: 8192,
        onRow: async (row, index) => {
            currentBatch.push(row);

            // Process in batches to avoid memory issues
            if (currentBatch.length >= batchSize) {
                await processBatch(currentBatch);
                currentBatch = [];
                processedCount += batchSize;
                console.log(`Processed ${processedCount} rows`);
            }
        },
        onEnd: async (result) => {
            // Process remaining rows
            if (currentBatch.length > 0) {
                await processBatch(currentBatch);
                processedCount += currentBatch.length;
            }

            console.log(`Final count: ${processedCount} rows processed`);
        },
    });
}

async function processBatch(batch: any[]) {
    // Simulate processing (e.g., database insertion, API calls, etc.)
    // In real usage, you might insert into a database, send to an API, etc.
    console.log(`Processing batch of ${batch.length} items`);

    // Simulate async processing
    await new Promise((resolve) => setTimeout(resolve, 10));
}

// Example 9: Custom headers
export function customHeadersExample() {
    const csvData = `John,25,New York
Jane,30,Los Angeles
Bob,35,Chicago`;

    const parser = createCSVParser({
        headers: ["name", "age", "city"], // Custom headers
    });

    const result = parser.parse(csvData);
    console.log("With custom headers:", result.rows);

    return result;
}

// Example 10: Different quote and escape characters
export function customQuoteEscapeExample() {
    const csvData = `name|age|description
John|25|'He said ''Hello'' to me'
Jane|30|'She likes ''pizza'' and ''pasta'''`;

    const parser = createCSVParser({
        delimiter: "|",
        quote: "'",
        escape: "'",
        headers: true,
    });

    const result = parser.parse(csvData);
    console.log("Custom quote/escape result:", result.rows);

    return result;
}
