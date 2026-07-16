export function parseCurl(curlText: string): { url: string; headers: Record<string, string> } {
  const urlMatch = curlText.match(/curl\s+'([^']+)'/) || curlText.match(/curl\s+"([^"]+)"/);
  if (!urlMatch) throw new Error("Couldn't find a URL in the pasted curl command.");
  const url = urlMatch[1];

  const headers: Record<string, string> = {};
  const headerRe = /-H\s+'([^:]+):\s*([^']*)'/g;
  let m: RegExpExecArray | null;
  while ((m = headerRe.exec(curlText))) {
    headers[m[1].toLowerCase()] = m[2];
  }
  const headerReDouble = /-H\s+"([^:]+):\s*([^"]*)"/g;
  while ((m = headerReDouble.exec(curlText))) {
    headers[m[1].toLowerCase()] = m[2];
  }

  const cookieMatch = curlText.match(/-b\s+'([^']*)'/) || curlText.match(/-b\s+"([^"]*)"/);
  if (cookieMatch) headers["cookie"] = cookieMatch[1];

  return { url, headers };
}
