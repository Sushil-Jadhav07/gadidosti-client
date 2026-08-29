// Maps a notification's { type, meta } (see backend's NotificationModel.create) to a page in
// this app — mirrors gadidosti-broker-driver's own lib/notificationRoutes.js/routeForNotification,
// adapted to the client app's own routes. Client notifications only ever carry booking_id
// (and sometimes trip_id) in meta — there's no client-facing equivalent of the driver/broker
// app's earnings/KYC screens to jump to for those types.
export function routeForNotification({ type, meta = {} }) {
  switch (type) {
    case "booking":
    case "payment":
    case "dispute":
    case "incident":
    case "chat":
      return meta.booking_id ? `/bookings/${meta.booking_id}` : null;
    default:
      return null;
  }
}
