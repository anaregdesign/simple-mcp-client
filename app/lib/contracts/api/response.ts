export type ApiSuccessResponseBody<TData, TMeta = never> = TMeta extends never
  ? { data: TData }
  : { data: TData; meta: TMeta };

export type ApiErrorBody<TDetails = unknown> = {
  code: string;
  message: string;
  details?: TDetails;
};

export type ApiErrorResponseBody<TDetails = unknown> = {
  error: ApiErrorBody<TDetails>;
};

export type ApiResponseBody<TData, TMeta = never, TDetails = unknown> =
  | ApiSuccessResponseBody<TData, TMeta>
  | ApiErrorResponseBody<TDetails>;
