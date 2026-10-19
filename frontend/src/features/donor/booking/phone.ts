/** Link tel: a partir do telefone exibido ("0800 000 0101" → "tel:08000000101"). */
export const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;
