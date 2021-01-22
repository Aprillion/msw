import { HeadersList } from 'headers-utils'
import { StrictEventEmitter } from 'strict-event-emitter'
import { MockedRequest, RequestHandler } from '../utils/handlers/requestHandler'
import { MockedResponse } from '../response'
import { SharedOptions } from '../sharedOptions'
import { ServiceWorkerMessage } from '../utils/createBroadcastChannel'
import { createStart } from './start/createStart'
import { createStop } from './stop/createStop'
import { RequestHandler as RequestHandlerClass } from '../utils/handlers/2.0/RequestHandler'

export type Mask = RegExp | string
export type ResolvedMask = Mask | URL

type RequestWithoutMethods = Omit<
  Request,
  | 'text'
  | 'body'
  | 'json'
  | 'blob'
  | 'arrayBuffer'
  | 'formData'
  | 'clone'
  | 'signal'
  | 'isHistoryNavigation'
  | 'isReloadNavigation'
>

/**
 * Request representation received from the worker message event.
 */
export interface ServiceWorkerIncomingRequest extends RequestWithoutMethods {
  /**
   * Unique UUID of the request generated once the request is
   * captured by the "fetch" event in the Service Worker.
   */
  id: string

  /**
   * Text response body.
   */
  body: string | undefined
}

export interface ServiceWorkerIncomingResponse extends Response {
  requestId: string
}

/**
 * Map of the events that can be received from the Service Worker.
 */
export interface ServiceWorkerIncomingEventsMap {
  MOCKING_ENABLED: boolean
  INTEGRITY_CHECK_RESPONSE: string
  KEEPALIVE_RESPONSE: never
  REQUEST: ServiceWorkerIncomingRequest
  RESPONSE: ServiceWorkerIncomingResponse
}

/**
 * Map of the events that can be sent to the Service Worker
 * from any execution context.
 */
export type ServiceWorkerOutgoingEventTypes =
  | 'MOCK_ACTIVATE'
  | 'MOCK_DEACTIVATE'
  | 'INTEGRITY_CHECK_REQUEST'
  | 'KEEPALIVE_REQUEST'
  | 'CLIENT_CLOSED'

/**
 * Map of the events that can be sent to the Service Worker
 * only as a part of a single `fetch` event handler.
 */
export type ServiceWorkerFetchEventTypes =
  | 'MOCK_SUCCESS'
  | 'MOCK_NOT_FOUND'
  | 'NETWORK_ERROR'
  | 'INTERNAL_ERROR'

export interface WorkerLifecycleEventsMap {
  'request:start': (req: MockedRequest) => void
  'request:match': (req: MockedRequest) => void
  'request:unhandled': (req: MockedRequest) => void
  'request:end': (req: MockedRequest) => void
  'response:mocked': (res: Response, requestId: string) => void
  'response:bypass': (res: Response, requestId: string) => void
}

export interface SetupWorkerInternalContext {
  startOptions: StartOptions | undefined
  worker: ServiceWorker | null
  registration: ServiceWorkerRegistration | null
  requestHandlers: RequestApplicator[]
  emitter: StrictEventEmitter<WorkerLifecycleEventsMap>
  keepAliveInterval?: number
  workerChannel: {
    /**
     * Adds a Service Worker event listener.
     */
    on<EventType extends keyof ServiceWorkerIncomingEventsMap>(
      eventType: EventType,
      callback: (
        event: MessageEvent,
        message: ServiceWorkerMessage<
          EventType,
          ServiceWorkerIncomingEventsMap[EventType]
        >,
      ) => void,
    ): void
    send<EventType extends ServiceWorkerOutgoingEventTypes>(
      eventType: EventType,
    ): void
  }
  events: {
    /**
     * Adds an event listener on the given target.
     * Returns a clean-up function that removes that listener.
     */
    addListener<E extends Event>(
      target: EventTarget,
      eventType: string,
      listener: (event: E) => void,
    ): () => void
    /**
     * Removes all currently attached listeners.
     */
    removeAllListeners(): void
    /**
     * Awaits a given message type from the Service Worker.
     */
    once<EventType extends keyof ServiceWorkerIncomingEventsMap>(
      eventType: EventType,
    ): Promise<
      ServiceWorkerMessage<EventType, ServiceWorkerIncomingEventsMap[EventType]>
    >
  }
}

export type ServiceWorkerInstanceTuple = [
  ServiceWorker | null,
  ServiceWorkerRegistration,
]

export type FindWorker = (
  scriptUrl: string,
  mockServiceWorkerUrl: string,
) => boolean

export type StartOptions = SharedOptions & {
  /**
   * Service Worker instance options.
   */
  serviceWorker?: {
    url?: string
    options?: RegistrationOptions
  }

  /**
   * Disables the logging of captured requests
   * into browser's console.
   */
  quiet?: boolean

  /**
   * Defers any network requests until the Service Worker
   * instance is ready. Defaults to `true`.
   */
  waitUntilReady?: boolean

  /**
   * A custom lookup function to find a Mock Service Worker in the list
   * of all registered Service Workers on the page.
   */
  findWorker?: FindWorker
}

export type RequestApplicator = RequestHandlerClass
export type RequestHandlersList = RequestHandler<any, any, any, any, any>[]

export type ResponseWithSerializedHeaders<BodyType = any> = Omit<
  MockedResponse<BodyType>,
  'headers'
> & {
  headers: HeadersList
}

export interface SetupWorkerApi {
  /**
   * Registers and activates the mock Service Worker.
   * @see {@link https://mswjs.io/docs/api/setup-worker/start `worker.start()`}
   */
  start: ReturnType<typeof createStart>

  /**
   * Stops requests interception for the current client.
   * @see {@link https://mswjs.io/docs/api/setup-worker/stop `worker.stop()`}
   */
  stop: ReturnType<typeof createStop>

  /**
   * Prepends given request handlers to the list of existing handlers.
   * @param {RequestHandler[]} handlers List of runtime request handlers.
   * @see {@link https://mswjs.io/docs/api/setup-worker/use `worker.use()`}
   */
  use: (...handlers: RequestApplicator[]) => void

  /**
   * Marks all request handlers that respond using `res.once()` as unused.
   * @see {@link https://mswjs.io/docs/api/setup-worker/restore-handlers `worker.restoreHandlers()`}
   */
  restoreHandlers: () => void

  /**
   * Resets request handlers to the initial list given to the `setupWorker` call, or to the explicit next request handlers list, if given.
   * @param {RequestHandler[]} nextHandlers List of the new initial request handlers.
   * @see {@link https://mswjs.io/docs/api/setup-worker/reset-handlers `worker.resetHandlers()`}
   */
  resetHandlers: (...nextHandlers: RequestApplicator[]) => void

  /**
   * Lists all active request handlers.
   * @see {@link https://mswjs.io/docs/api/setup-worker/print-handlers `worker.printHandlers()`}
   */
  printHandlers: () => void

  /**
   * Attaches a listener to one of the life-cycle events.
   */
  on<EventType extends keyof WorkerLifecycleEventsMap>(
    eventType: EventType,
    listener: WorkerLifecycleEventsMap[EventType],
  ): void
}
