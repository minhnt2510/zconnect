const normalizeIp = (ip: string) => {
  const cleaned = String(ip || '').trim();
  if (!cleaned || cleaned === 'unknown') return '';
  return cleaned.replace(/^::ffff:/, '');
};

export const getClientIp = (req: any): string => {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (forwarded) {
    const first = normalizeIp(String(forwarded).split(',')[0]);
    if (first) return first;
  }
  const direct = normalizeIp(req?.ip || req?.socket?.remoteAddress);
  return direct || '';
};
