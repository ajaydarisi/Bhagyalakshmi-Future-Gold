export function isCurrentAssistantRequest(args: {
  activeRequestId: string | undefined;
  requestId: string;
  wasCancelled: boolean;
}) {
  return !args.wasCancelled && args.activeRequestId === args.requestId;
}
