import theme from './tokens.json';

/** 4pt-grid spacing scale, indexed: space[4] === 12px. */
export const space = theme.space;

export const radius = theme.radius;

/** Minimum touch target sizes (dp). Driver app uses `driver` everywhere. */
export const touchTarget = { default: 48, driver: 56 } as const;
