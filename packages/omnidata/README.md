## CSV Parser

A comprehensive CSV parser that works in both browser and Node.js environments with streaming support for large files.

### Features

- ✅ **Universal**: Works in both browser and Node.js environments
- ✅ **Simple APIs**: Choose your complexity level - from super simple to full control
- ✅ **Auto-detection**: Automatically chooses streaming vs non-streaming based on usage
- ✅ **Streaming**: Memory-efficient parsing for large files
- ✅ **Configurable**: Custom delimiters, quotes, escape characters
- ✅ **Headers**: Automatic header detection or custom headers
- ✅ **Error Handling**: Detailed error reporting with line/column information
- ✅ **TypeScript**: Full TypeScript support with type definitions
- ✅ **Standards Compliant**: Follows RFC 4180 CSV specification
- ✅ **Performance**: Optimized for speed and memory usage

### Installation

```bash
npm install omnidata
```

### Quick Start

#### 🚀 Super Simple API (Recommended for beginners)

```typescript
import { parseCSVSimple } from 'omnidata/csv';

// Parse CSV string
const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles`;

const result = await parseCSVSimple(csvData);
console.log(result.rows);
// [
//   { name: 'John', age: '25', city: 'New York' },
//   { name: 'Jane', age: '30', city: 'Los Angeles' }
// ]

// Parse file (works in both browser and Node.js)
const fileResult = await parseCSVSimple(file); // File object or file path
console.log(fileResult.rows);
```

#### 🎯 Unified API (Auto-detects streaming)

```typescript
import { parseCSV } from 'omnidata/csv';

// Non-streaming mode (loads all data into memory)
const result = await parseCSV(csvData, { headers: true });
if (result) {
  console.log('All data:', result.rows);
}

// Streaming mode (auto-detected by callbacks)
await parseCSV(largeFile, {
  headers: true,
  onRow: (row, index) => {
    console.log(`Row ${index}:`, row);
    // Process each row immediately
  },
  onEnd: (result) => {
    console.log(`Finished processing ${result.totalRows} rows`);
  }
});
```

#### 📊 Explicit Streaming API (For large files)

```typescript
import { parseCSVStream } from 'omnidata/csv';

await parseCSVStream(largeFile, {
  onRow: (row, index) => {
    // Process each row as it comes
    processRow(row);
  },
  onHeaders: (headers) => {
    console.log('Headers:', headers);
  },
  onEnd: (result) => {
    console.log(`Processed ${result.totalRows} rows`);
  }
}, {
  headers: true,
  chunkSize: 16384 // 16KB chunks
});
```

### API Comparison

| API | Use Case | Returns Data | Memory Usage | Complexity |
|-----|----------|--------------|--------------|------------|
| `parseCSVSimple()` | Small files, quick prototyping | ✅ All at once | Higher | Lowest |
| `parseCSV()` (non-streaming) | Medium files, full control | ✅ All at once | Higher | Medium |
| `parseCSV()` (streaming) | Large files, auto-detected | ❌ Via callbacks | Lower | Medium |
| `parseCSVStream()` | Large files, explicit control | ❌ Via callbacks | Lowest | Higher |

### When to Use Each API

#### 📝 Use `parseCSVSimple()` when:
- You're just getting started
- File size < 10MB
- You want the simplest possible API
- You need all data loaded at once

#### 🔧 Use `parseCSV()` when:
- You want automatic streaming detection
- You need more configuration options
- File size varies (small to large)
- You want one API for all use cases

#### 🚀 Use `parseCSVStream()` when:
- File size > 100MB
- Memory usage is critical
- You need maximum performance
- You want explicit streaming control

### Detailed Examples

#### Simple File Upload (Browser)

```typescript
import { parseCSVSimple } from 'omnidata/csv';

// HTML: <input type="file" id="csvFile" accept=".csv">
const fileInput = document.getElementById('csvFile') as HTMLInputElement;
fileInput.addEventListener('change', async (event) => {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (file) {
    try {
      const result = await parseCSVSimple(file);
      console.log(`Loaded ${result.rows.length} rows`);
      displayData(result.rows);
    } catch (error) {
      console.error('Parse error:', error);
    }
  }
});
```

#### Large File Processing (Node.js)

```typescript
import { parseCSVStream } from 'omnidata/csv';

async function processLargeCSV(filePath: string) {
  let processedCount = 0;
  const batchSize = 1000;
  let currentBatch: any[] = [];

  await parseCSVStream(filePath, {
    onRow: async (row) => {
      currentBatch.push(row);
      
      // Process in batches to save memory
      if (currentBatch.length >= batchSize) {
        await insertToDatabase(currentBatch);
        currentBatch = [];
        processedCount += batchSize;
        console.log(`Processed ${processedCount} rows`);
      }
    },
    onEnd: async () => {
      // Process remaining rows
      if (currentBatch.length > 0) {
        await insertToDatabase(currentBatch);
      }
      console.log('Processing complete!');
    }
  }, {
    headers: true,
    chunkSize: 32768 // 32KB chunks for better performance
  });
}
```

#### Auto-Detection Example

```typescript
import { parseCSV } from 'omnidata/csv';

// This function automatically chooses the right approach
async function smartParseCSV(input: string | File | string) {
  // For small data - returns all results
  if (typeof input === 'string' && input.length < 1000000) { // < 1MB
    const result = await parseCSV(input, { headers: true });
    return result?.rows;
  }
  
  // For large data - uses streaming
  const rows: any[] = [];
  await parseCSV(input, {
    headers: true,
    onRow: (row) => {
      rows.push(row);
      // Could also process immediately instead of collecting
    },
    onEnd: (result) => {
      console.log(`Streamed ${result.totalRows} rows`);
    }
  });
  
  return rows;
}
```

### Advanced Configuration

#### Custom Delimiters and Formats

```typescript
// Tab-separated values
const tsvResult = await parseCSVSimple(tsvData, { 
  delimiter: '\t' 
});

// Semicolon-separated with custom quotes
const result = await parseCSV(csvData, {
  delimiter: ';',
  quote: "'",
  escape: "\\",
  headers: true
});

// Pipe-separated with custom headers
const pipeResult = await parseCSV(pipeData, {
  delimiter: '|',
  headers: ['name', 'age', 'city']
});
```

#### Error Handling

```typescript
import { parseCSVSimple } from 'omnidata/csv';

try {
  const result = await parseCSVSimple(problematicCSV);
  
  // Check for parsing errors
  if (result.errors.length > 0) {
    console.log('Parsing errors found:');
    result.errors.forEach(error => {
      console.log(`Line ${error.line}, Column ${error.column}: ${error.message}`);
    });
  }
  
  // Process valid rows
  console.log(`Successfully parsed ${result.rows.length} rows`);
  
} catch (error) {
  console.error('Failed to parse CSV:', error);
}
```

#### Memory-Efficient Streaming

```typescript
import { parseCSVStream } from 'omnidata/csv';

// Process 1GB+ files without memory issues
await parseCSVStream('/path/to/huge-file.csv', {
  onRow: (row, index) => {
    // Process immediately, don't store in memory
    if (row.status === 'active') {
      sendToAPI(row);
    }
    
    // Progress indicator
    if (index % 10000 === 0) {
      console.log(`Processed ${index} rows...`);
    }
  },
  onError: (error) => {
    console.error(`Error at line ${error.line}:`, error.message);
    // Continue processing despite errors
  }
}, {
  headers: true,
  chunkSize: 65536, // 64KB chunks for maximum performance
  skipEmptyLines: true
});
```

### Migration Guide

#### From Basic CSV Libraries

```typescript
// Before (typical CSV library)
import csv from 'some-csv-lib';
const data = csv.parse(csvString);

// After (omnidata - simple)
import { parseCSVSimple } from 'omnidata/csv';
const result = await parseCSVSimple(csvString);
const data = result.rows;
```

#### From Streaming CSV Libraries

```typescript
// Before (streaming CSV library)
import csv from 'streaming-csv-lib';
csv.parseFile('file.csv')
  .on('data', (row) => process(row))
  .on('end', () => console.log('done'));

// After (omnidata - streaming)
import { parseCSVStream } from 'omnidata/csv';
await parseCSVStream('file.csv', {
  onRow: (row) => process(row),
  onEnd: () => console.log('done')
});
```

### Performance Tips

1. **Choose the right API**: Use `parseCSVSimple()` for small files, `parseCSVStream()` for large files
2. **Adjust chunk size**: Larger chunks (32KB-64KB) improve performance for very large files
3. **Process immediately**: In streaming mode, process rows immediately instead of collecting them
4. **Use batching**: For database operations, batch inserts for better performance
5. **Skip empty lines**: Enable `skipEmptyLines` to avoid processing unnecessary data

### Browser Compatibility

- Chrome 88+
- Firefox 85+
- Safari 14+
- Edge 88+

### Node.js Compatibility

- Node.js 14+
- Supports both CommonJS and ES modules

### Complete API Reference

#### parseCSVSimple()
```typescript
parseCSVSimple(
  input: string | File | string,
  options?: {
    headers?: boolean | string[];
    delimiter?: string;
  }
): Promise<CSVParseResult>
```

#### parseCSV()
```typescript
parseCSV(
  input: string | File | string,
  options?: CSVParseOptions & {
    stream?: boolean;
    onRow?: (row, index) => void;
    onHeaders?: (headers) => void;
    onError?: (error) => void;
    onEnd?: (result) => void;
  }
): Promise<CSVParseResult | void>
```

#### parseCSVStream()
```typescript
parseCSVStream(
  input: File | string,
  callbacks: {
    onRow: (row, index) => void;
    onHeaders?: (headers) => void;
    onError?: (error) => void;
    onEnd?: (result) => void;
  },
  options?: CSVParseOptions
): Promise<void>
```

### License

MIT License 