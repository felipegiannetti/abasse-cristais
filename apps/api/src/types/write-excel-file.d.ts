// write-excel-file is ESM-first and ships its types behind package.json "exports", which this project's
// CommonJS/node10 module resolution cannot see. This declares only the part of the API the exports use.
declare module 'write-excel-file/node' {
  type Scalar = string | number | boolean | Date;
  export interface XlsxCell {
    value: Scalar;
    type?: StringConstructor | NumberConstructor | BooleanConstructor | DateConstructor;
    format?: string;
    fontWeight?: 'bold';
  }
  export interface XlsxSheet {
    sheet: string;
    columns?: { width?: number }[];
    data: (XlsxCell | null)[][];
  }
  const writeXlsxFile: (sheets: XlsxSheet[]) => { toBuffer(): Promise<Buffer> };
  export default writeXlsxFile;
}
