import { promises as dns } from "node:dns";
import { isIP } from "node:net";
import { URL } from "node:url";

const PRIVATE_RANGES = [
    { prefix: "10." },
    { prefix: "172.16." },
    { prefix: "172.17." },
    { prefix: "172.18." },
    { prefix: "172.19." },
    { prefix: "172.20." },
    { prefix: "172.21." },
    { prefix: "172.22." },
    { prefix: "172.23." },
    { prefix: "172.24." },
    { prefix: "172.25." },
    { prefix: "172.26." },
    { prefix: "172.27." },
    { prefix: "172.28." },
    { prefix: "172.29." },
    { prefix: "172.30." },
    { prefix: "172.31." },
    { prefix: "192.168." },
    { prefix: "127." },
    { prefix: "0." },
    { prefix: "169.254." },
];

export function isPrivateIp(address: string): boolean {
    if (isIP(address) !== 4) return false;
    return PRIVATE_RANGES.some((range) => address.startsWith(range.prefix));
}

/**
 * Valida host/protocolo/DNS de uma URL antes de passá-la a um downloader
 * externo (yt-dlp). Lança se a URL não for permitida ou resolver para IP
 * privado (proteção SSRF — sem isso, uma URL como http://169.254.169.254/
 * poderia ser usada para acessar metadata interna do host).
 */
export async function assertPublicHttpUrl(url: string, allowedHosts: string[]): Promise<URL> {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        throw new Error("URL inválida");
    }
    if (!allowedHosts.includes(parsed.hostname)) {
        throw new Error(`URL não permitida: ${parsed.hostname}`);
    }
    if (!["http:", "https:"].includes(parsed.protocol)) {
        throw new Error(`Protocolo não permitido: ${parsed.protocol}`);
    }

    const resolved = await dns.resolve4(parsed.hostname).catch(() => []);
    for (const ip of resolved) {
        if (isPrivateIp(ip)) {
            throw new Error(`URL rejeitada: ${parsed.hostname} resolve para IP privado (SSRF)`);
        }
    }

    return parsed;
}
