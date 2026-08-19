import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Class-name merge used by the shadcn/ui components under `src/components/ui`.
 *
 * Deliberately separate from the app's own `@/utils/cn`, which is a plain
 * truthy-filter join. shadcn variants rely on tailwind-merge to resolve
 * conflicting utilities (a `px-4` passed by a caller must beat the variant's
 * `px-2`); a plain join emits both and the winner becomes stylesheet-order
 * dependent. The two helpers are not interchangeable, so both exist:
 * `@/lib/utils` for shadcn components, `@/utils/cn` for the IFFS components.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
