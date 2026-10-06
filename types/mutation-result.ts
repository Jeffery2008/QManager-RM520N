/** A mutator's outcome, returned so a handler never reads hook `error` state after an `await`. */
export interface MutationResult {
  ok: boolean;
  /** Failure reason; null on success or when the component unmounted mid-call. */
  error: string | null;
}
