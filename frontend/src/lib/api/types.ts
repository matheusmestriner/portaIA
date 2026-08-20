export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    correlationId: string;
    details?: unknown;
  };
}

export class ApiError extends Error {
  code: string;
  status: number;
  correlationId: string;
  details?: unknown;

  constructor(status: number, body: ApiErrorBody) {
    super(body.error.message);
    this.name = "ApiError";
    this.status = status;
    this.code = body.error.code;
    this.correlationId = body.error.correlationId;
    this.details = body.error.details;
  }
}
