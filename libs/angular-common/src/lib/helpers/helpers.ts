import { ActivatedRouteSnapshot } from '@angular/router';

/**
 * Get a given route data attribute from the current route.
 * Does not update on navigation changes.
 */
export function getDataPropertyFromActivatedRouteSnapshot(
  activatedRoute: ActivatedRouteSnapshot | null,
  property: string
) {
  let child = activatedRoute;
  while (child) {
    if (child.firstChild) {
      child = child.firstChild;
    } else if (child.data && child.data[property]) {
      return child.data[property];
    } else {
      return null;
    }
  }
  return null;
}

export function formatDateToGerman(date: Date): string {
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear();
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');

  return `${day}-${month}-${year}-${hours}:${minutes}`;
}
