import {
    CSVParser,
    createCSVParser,
    parseCSV,
    parseCSVSimple,
    parseCSVStream,
} from "./index";

describe("CSV Parser", () => {
    // ========================================
    // NEW SIMPLIFIED API TESTS
    // ========================================

    describe("parseCSVSimple", () => {
        test("should parse CSV string with default options", async () => {
            const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles`;

            const result = await parseCSVSimple(csvData);

            expect(result.headers).toEqual(["name", "age", "city"]);
            expect(result.rows).toEqual([
                { name: "John", age: "25", city: "New York" },
                { name: "Jane", age: "30", city: "Los Angeles" },
            ]);
            expect(result.errors).toHaveLength(0);
        });

        test("should handle custom delimiter", async () => {
            const tsvData = `name\tage\tcity
John\t25\tNew York`;

            const result = await parseCSVSimple(tsvData, { delimiter: "\t" });

            expect(result.headers).toEqual(["name", "age", "city"]);
            expect(result.rows).toEqual([
                { name: "John", age: "25", city: "New York" },
            ]);
        });

        test("should handle custom headers", async () => {
            const csvData = `John,25,New York
Jane,30,Los Angeles`;

            const result = await parseCSVSimple(csvData, {
                headers: ["name", "age", "city"],
            });

            expect(result.headers).toEqual(["name", "age", "city"]);
            expect(result.rows).toEqual([
                { name: "John", age: "25", city: "New York" },
                { name: "Jane", age: "30", city: "Los Angeles" },
            ]);
        });
    });

    describe("parseCSV unified API", () => {
        test("should parse in non-streaming mode by default", async () => {
            const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles`;

            const result = await parseCSV(csvData, { headers: true });

            expect(result).toBeDefined();
            expect(result!.headers).toEqual(["name", "age", "city"]);
            expect(result!.rows).toEqual([
                { name: "John", age: "25", city: "New York" },
                { name: "Jane", age: "30", city: "Los Angeles" },
            ]);
        });

        test("should auto-detect streaming mode when onRow is provided", async () => {
            const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles`;

            const rows: any[] = [];
            let headers: string[] = [];

            const result = await parseCSV(csvData, {
                headers: true,
                onHeaders: (h) => {
                    headers = h;
                },
                onRow: (row, index) => {
                    rows.push(row);
                },
            });

            expect(result).toBeUndefined(); // Streaming mode returns void
            expect(headers).toEqual(["name", "age", "city"]);
            expect(rows).toEqual([
                { name: "John", age: "25", city: "New York" },
                { name: "Jane", age: "30", city: "Los Angeles" },
            ]);
        });

        test("should force streaming mode when stream: true", async () => {
            const csvData = `name,age,city
John,25,New York`;

            const rows: any[] = [];

            const result = await parseCSV(csvData, {
                headers: true,
                stream: true,
                onRow: (row) => {
                    rows.push(row);
                },
            });

            expect(result).toBeUndefined(); // Streaming mode returns void
            expect(rows).toHaveLength(1);
        });
    });

    describe("parseCSVStream explicit API", () => {
        test("should handle explicit streaming", async () => {
            const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles`;

            const rows: any[] = [];
            let headers: string[] = [];
            let endCalled = false;

            await parseCSVStream(
                csvData as any, // Type assertion for test
                {
                    onHeaders: (h) => {
                        headers = h;
                    },
                    onRow: (row, index) => {
                        rows.push(row);
                    },
                    onEnd: (result) => {
                        endCalled = true;
                        expect(result.totalRows).toBe(2);
                    },
                },
                { headers: true }
            );

            expect(headers).toEqual(["name", "age", "city"]);
            expect(rows).toHaveLength(2);
            expect(endCalled).toBe(true);
        });
    });

    // ========================================
    // ORIGINAL TESTS
    // ========================================

    describe("Basic parsing", () => {
        test("should parse simple CSV without headers", () => {
            const csvData = `John,25,New York
Jane,30,Los Angeles
Bob,35,Chicago`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ["John", "25", "New York"],
                ["Jane", "30", "Los Angeles"],
                ["Bob", "35", "Chicago"],
            ]);
            expect(result.headers).toBeUndefined();
            expect(result.errors).toHaveLength(0);
        });

        test("should parse CSV with headers", () => {
            const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles`;

            const parser = createCSVParser({ headers: true });
            const result = parser.parse(csvData);

            expect(result.headers).toEqual(["name", "age", "city"]);
            expect(result.rows).toEqual([
                { name: "John", age: "25", city: "New York" },
                { name: "Jane", age: "30", city: "Los Angeles" },
            ]);
            expect(result.errors).toHaveLength(0);
        });

        test("should handle custom headers", () => {
            const csvData = `John,25,New York
Jane,30,Los Angeles`;

            const parser = createCSVParser({
                headers: ["name", "age", "city"],
            });
            const result = parser.parse(csvData);

            expect(result.headers).toEqual(["name", "age", "city"]);
            expect(result.rows).toEqual([
                { name: "John", age: "25", city: "New York" },
                { name: "Jane", age: "30", city: "Los Angeles" },
            ]);
        });
    });

    describe("Quoted fields", () => {
        test("should handle quoted fields", () => {
            const csvData = `"John Doe","25","New York"
"Jane Smith","30","Los Angeles"`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ["John Doe", "25", "New York"],
                ["Jane Smith", "30", "Los Angeles"],
            ]);
        });

        test("should handle fields with commas in quotes", () => {
            const csvData = `"Doe, John","25","New York, NY"
"Smith, Jane","30","Los Angeles, CA"`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ["Doe, John", "25", "New York, NY"],
                ["Smith, Jane", "30", "Los Angeles, CA"],
            ]);
        });

        test("should handle escaped quotes", () => {
            const csvData = `"John ""Johnny"" Doe","25","New York"
"Jane ""Janie"" Smith","30","Los Angeles"`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ['John "Johnny" Doe', "25", "New York"],
                ['Jane "Janie" Smith', "30", "Los Angeles"],
            ]);
        });
    });

    describe("Custom delimiters", () => {
        test("should handle semicolon delimiter", () => {
            const csvData = `John;25;New York
Jane;30;Los Angeles`;

            const parser = createCSVParser({ delimiter: ";" });
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ["John", "25", "New York"],
                ["Jane", "30", "Los Angeles"],
            ]);
        });

        test("should handle tab delimiter", () => {
            const csvData = `John\t25\tNew York
Jane\t30\tLos Angeles`;

            const parser = createCSVParser({ delimiter: "\t" });
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ["John", "25", "New York"],
                ["Jane", "30", "Los Angeles"],
            ]);
        });

        test("should handle pipe delimiter", () => {
            const csvData = `John|25|New York
Jane|30|Los Angeles`;

            const parser = createCSVParser({ delimiter: "|" });
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ["John", "25", "New York"],
                ["Jane", "30", "Los Angeles"],
            ]);
        });
    });

    describe("Line endings", () => {
        test("should handle \\n line endings", () => {
            const csvData = `John,25,New York\nJane,30,Los Angeles\nBob,35,Chicago`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toHaveLength(3);
            expect(result.rows[0]).toEqual(["John", "25", "New York"]);
        });

        test("should handle \\r\\n line endings", () => {
            const csvData = `John,25,New York\r\nJane,30,Los Angeles\r\nBob,35,Chicago`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toHaveLength(3);
            expect(result.rows[0]).toEqual(["John", "25", "New York"]);
        });

        test("should handle \\r line endings", () => {
            const csvData = `John,25,New York\rJane,30,Los Angeles\rBob,35,Chicago`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toHaveLength(3);
            expect(result.rows[0]).toEqual(["John", "25", "New York"]);
        });
    });

    describe("Empty lines and fields", () => {
        test("should skip empty lines when configured", () => {
            const csvData = `John,25,New York

Jane,30,Los Angeles

Bob,35,Chicago`;

            const parser = createCSVParser({ skipEmptyLines: true });
            const result = parser.parse(csvData);

            expect(result.rows).toHaveLength(3);
            expect(result.rows).toEqual([
                ["John", "25", "New York"],
                ["Jane", "30", "Los Angeles"],
                ["Bob", "35", "Chicago"],
            ]);
        });

        test("should include empty lines when not configured to skip", () => {
            const csvData = `John,25,New York

Jane,30,Los Angeles`;

            const parser = createCSVParser({ skipEmptyLines: false });
            const result = parser.parse(csvData);

            expect(result.rows).toHaveLength(3);
            expect(result.rows[1]).toEqual([""]);
        });

        test("should handle empty fields", () => {
            const csvData = `John,,New York
,30,Los Angeles
Bob,35,`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ["John", "", "New York"],
                ["", "30", "Los Angeles"],
                ["Bob", "35", ""],
            ]);
        });
    });

    describe("Error handling", () => {
        test("should detect unclosed quotes", () => {
            const csvData = `"John,25,New York
Jane,30,Los Angeles`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].message).toContain("Unclosed quoted field");
        });

        test("should detect unexpected quotes", () => {
            const csvData = `John"Doe,25,New York`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].message).toContain(
                "Unexpected quote character"
            );
        });

        test("should provide error location information", () => {
            const csvData = `John,25,New York
Jane"Smith,30,Los Angeles`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].line).toBe(2);
            expect(result.errors[0].column).toBe(5);
        });
    });

    describe("Streaming", () => {
        test("should handle streaming parsing", () => {
            const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles
Bob,35,Chicago`;

            const parser = createCSVParser({ headers: true });
            const rows: any[] = [];
            let headers: string[] = [];

            const stream = parser.parseStream({
                onHeaders: (h) => {
                    headers = h;
                },
                onRow: (row) => {
                    rows.push(row);
                },
            });

            // Simulate streaming by writing chunks
            const chunks = csvData.split("\n");
            chunks.forEach((chunk, index) => {
                stream.write(chunk + (index < chunks.length - 1 ? "\n" : ""));
            });
            stream.end();

            expect(headers).toEqual(["name", "age", "city"]);
            expect(rows).toHaveLength(3);
            expect(rows[0]).toEqual({
                name: "John",
                age: "25",
                city: "New York",
            });
        });

        test("should handle chunked streaming", () => {
            const csvData = `name,age,city
John,25,New York
Jane,30,Los Angeles`;

            const parser = createCSVParser({ headers: true });
            const rows: any[] = [];

            const stream = parser.parseStream({
                onRow: (row) => {
                    rows.push(row);
                },
            });

            // Write in small chunks to test chunk boundary handling
            for (let i = 0; i < csvData.length; i += 5) {
                stream.write(csvData.slice(i, i + 5));
            }
            stream.end();

            expect(rows).toHaveLength(2);
            expect(rows[0]).toEqual({
                name: "John",
                age: "25",
                city: "New York",
            });
        });
    });

    describe("Custom quote and escape characters", () => {
        test("should handle custom quote character", () => {
            const csvData = `'John Doe','25','New York'
'Jane Smith','30','Los Angeles'`;

            const parser = createCSVParser({ quote: "'" });
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ["John Doe", "25", "New York"],
                ["Jane Smith", "30", "Los Angeles"],
            ]);
        });

        test("should handle custom escape character", () => {
            const csvData = `'John \\'Johnny\\' Doe','25','New York'`;

            const parser = createCSVParser({
                quote: "'",
                escape: "\\",
            });
            const result = parser.parse(csvData);

            expect(result.rows[0]).toEqual([
                "John 'Johnny' Doe",
                "25",
                "New York",
            ]);
        });
    });

    describe("Edge cases", () => {
        test("should handle single field", () => {
            const csvData = `John`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([["John"]]);
        });

        test("should handle empty CSV", () => {
            const csvData = ``;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([]);
        });

        test("should handle CSV with only headers", () => {
            const csvData = `name,age,city`;

            const parser = createCSVParser({ headers: true });
            const result = parser.parse(csvData);

            expect(result.headers).toEqual(["name", "age", "city"]);
            expect(result.rows).toEqual([]);
        });

        test("should handle trailing comma", () => {
            const csvData = `John,25,New York,
Jane,30,Los Angeles,`;

            const parser = createCSVParser();
            const result = parser.parse(csvData);

            expect(result.rows).toEqual([
                ["John", "25", "New York", ""],
                ["Jane", "30", "Los Angeles", ""],
            ]);
        });
    });
});
