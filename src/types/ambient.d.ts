declare module 'marked' {
  export function parse(src: string): string;
}

declare module 'dompurify' {
  const DOMPurify: {
    sanitize(dirty: string): string;
  };
  export default DOMPurify;
}
