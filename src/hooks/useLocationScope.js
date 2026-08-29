/**
 * useLocationScope
 *
 * Returns location-scoping information for the currently logged-in user.
 *
 * For owners (is_owner = true):
 *   - userLocations is null (unrestricted — sees all locations).
 *   - isOwner = true.
 *   - isScopedToLocation = false.
 *
 * For staff (is_owner = false):
 *   - userLocations is an array of location IDs they are assigned to.
 *   - isOwner = false.
 *   - isScopedToLocation = true.
 *
 * Usage:
 *   const { isOwner, isScopedToLocation, scopedLocationIds } = useLocationScope();
 *
 *   // In a Supabase query for staff, call:
 *   if (isScopedToLocation && scopedLocationIds.length > 0) {
 *     query = query.in('location_id', scopedLocationIds);
 *   } else if (isScopedToLocation && scopedLocationIds.length === 0) {
 *     // User has no assigned locations — return empty result.
 *     return [];
 *   }
 */
import { useAuth } from '../context/AuthContext.jsx';

export default function useLocationScope() {
  const { profile, userLocations } = useAuth();

  const isOwner = !!profile?.is_owner;

  /*
   * For owners: null (unrestricted).
   * For staff: array of location IDs (may be empty if none assigned yet).
   */
  const scopedLocationIds = isOwner ? null : (userLocations ?? []);

  /*
   * True when the current user is a staff member who must be
   * restricted to specific locations.
   */
  const isScopedToLocation = !isOwner;

  /*
   * hasNoLocations: staff user with zero assigned locations.
   * In this state, all queries should return nothing.
   */
  const hasNoLocations = isScopedToLocation && scopedLocationIds.length === 0;

  return {
    isOwner,
    isScopedToLocation,
    scopedLocationIds,
    hasNoLocations,
  };
}
