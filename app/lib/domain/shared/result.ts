import type { DomainError } from "~/lib/domain/shared/domain-error";

export type SuccessResult<TValue> = {
  ok: true;
  value: TValue;
};

export type FailureResult<TError> = {
  ok: false;
  error: TError;
};

export type Result<TValue, TError = DomainError> =
  | SuccessResult<TValue>
  | FailureResult<TError>;

export function successResult<TValue>(value: TValue): SuccessResult<TValue> {
  return {
    ok: true,
    value,
  };
}

export function failureResult<TError>(error: TError): FailureResult<TError> {
  return {
    ok: false,
    error,
  };
}
