/* ═══════════════════════════════════════════════════════
   SkySignal 2.0 — Event Detail Drawer
   Inspection panel for meteorological analysts (SIH26069)
   Wrapper around EventDetailSheet with Admin RBAC guard
   ═══════════════════════════════════════════════════════ */

import { useAuth } from '../../context/AuthContext';
import EventDetailSheet from '../overlays/EventDetailSheet';
import type { WeatherEvent, LifecycleStatus } from '../../types/weather';

interface EventDetailDrawerProps {
  event: WeatherEvent | any | null;
  onClose: () => void;
  onStatusChange?: (eventId: string, newStatus: LifecycleStatus | any) => void;
}

export default function EventDetailDrawer({
  event,
  onClose,
  onStatusChange,
}: EventDetailDrawerProps) {
  const { isAdmin } = useAuth();

  // Guard: strictly cannot be mounted or rendered for Guests
  if (!isAdmin || !event) return null;

  return (
    <EventDetailSheet
      event={event}
      onClose={onClose}
      onStatusChange={onStatusChange}
    />
  );
}

export { EventDetailSheet };
