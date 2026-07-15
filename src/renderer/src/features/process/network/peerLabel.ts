interface PeerLabelRule {
  test: RegExp
  label: string
}

// Order matters: more specific patterns first.
const RULES: PeerLabelRule[] = [
  { test: /\.1e100\.net$/i, label: 'Google' },
  { test: /\.googleusercontent\.com$/i, label: 'Google Cloud' },
  { test: /\.googlevideo\.com$/i, label: 'YouTube' },
  { test: /\.(youtube|ytimg)\.com$/i, label: 'YouTube' },
  { test: /\.gstatic\.com$/i, label: 'Google' },
  { test: /\.google\.com$/i, label: 'Google' },
  { test: /\.cloudfront\.net$/i, label: 'CloudFront' },
  { test: /\.compute(-\d+)?\.amazonaws\.com$/i, label: 'AWS EC2' },
  { test: /\.s3[.-].*amazonaws\.com$/i, label: 'AWS S3' },
  { test: /\.amazonaws\.com$/i, label: 'AWS' },
  { test: /\.cloudapp\.(net|azure\.com)$/i, label: 'Azure' },
  { test: /\.azure(websites|edge)?\.(net|com)$/i, label: 'Azure' },
  { test: /\.akamai(technologies|edge|hd)?\.(net|com)$/i, label: 'Akamai' },
  { test: /\.fastly\.net$/i, label: 'Fastly' },
  { test: /\.cloudflare\.com$/i, label: 'Cloudflare' },
  { test: /\.fbcdn\.net$/i, label: 'Meta CDN' },
  { test: /\.(facebook|instagram|whatsapp)\.com$/i, label: 'Meta' },
  { test: /\.icloud\.com$/i, label: 'iCloud' },
  { test: /\.apple\.com$/i, label: 'Apple' },
  { test: /\.github(usercontent)?\.com$/i, label: 'GitHub' },
  { test: /\.githubusercontent\.com$/i, label: 'GitHub' },
  { test: /\.slack(-edge|-msgs)?\.com$/i, label: 'Slack' },
  { test: /\.discord(app)?\.com$/i, label: 'Discord' },
  { test: /\.openai\.com$/i, label: 'OpenAI' },
  { test: /\.anthropic\.com$/i, label: 'Anthropic' },
]

/**
 * Return a human-friendly label for a peer.
 *  - Known cloud PTR pattern → provider label
 *  - Otherwise the resolved hostname
 *  - Otherwise the raw IP (or "*" / empty as a fallback marker)
 */
export function peerLabel(ip: string, hostname: string | null): string {
  if (hostname) {
    for (const rule of RULES) {
      if (rule.test.test(hostname)) return rule.label
    }
    return hostname
  }
  return ip || '*'
}
