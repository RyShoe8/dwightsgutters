export const isPrivatePage = path => /^\/(?:admin(?:\/|$)|book\/change(?:\/|$))/.test(path);
