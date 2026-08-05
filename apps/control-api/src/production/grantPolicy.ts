import { ProductionDomainError } from './errors.js';
import type { ProductionCapability, ProductionScope } from './types.js';

function denied(message: string): never {
  throw new ProductionDomainError(message, 403, 'CAPABILITY_SCOPE_DENIED', 'scope');
}

export function assertGrantRequestAllowed(
  packageCapabilities: ProductionCapability[],
  requestedCapabilities: ProductionCapability[],
  requestedScopes: ProductionScope[],
): void {
  if (requestedCapabilities.some((capability) => !packageCapabilities.includes(capability))) {
    denied('请求的能力不在生产包范围内。');
  }

  const allowedScopes = new Set<ProductionScope>(['production.package.read']);
  if (requestedCapabilities.some((capability) => capability !== 'media.export')) {
    allowedScopes.add('production.task.write');
    allowedScopes.add('production.asset.write');
    allowedScopes.add('production.receipt.write');
  }
  if (requestedCapabilities.includes('media.export')) {
    allowedScopes.add('production.export.write');
    allowedScopes.add('production.asset.write');
    allowedScopes.add('production.receipt.write');
  }
  if (requestedScopes.some((scope) => !allowedScopes.has(scope))) {
    denied('请求的权限不能由所选生产能力授予。');
  }
}
