/**
 * API route module for /api/runtime/event-logs.
 */
import {
  handleRuntimeEventLogCollectionAction,
  handleRuntimeEventLogCollectionLoader,
} from "~/lib/server/infrastructure/runtime-event-logs/runtime-event-log-collection-action";

export function loader() {
  return handleRuntimeEventLogCollectionLoader();
}

export async function action({ request }: { request: Request }) {
  return handleRuntimeEventLogCollectionAction({ request });
}
