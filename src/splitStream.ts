import { Observable } from "rxjs/Rx";

/**
 * Split the given stream on the given separator (default '\n').
 * @param executor An observable returning each part.
 */
export function splitStream(readStream: NodeJS.ReadableStream, separator: string = "\n"): Observable<string> {
    return new Observable((subscriber) => {
        let buffer = "";

        readStream.on("data", (data) => {
                buffer += data;

                const parts = buffer.split(separator);
                // Save the final part as it may be incomplete
                const finalPart = parts.pop();
                buffer = finalPart || "";

                parts.forEach((part) => {
                    subscriber.next(part);
                });
        });
        readStream.on("end", () => {
            if (buffer.length > 0) {
                // Forward the final part before signalling that we are done
                subscriber.next(buffer);
            }
            subscriber.complete();
        });
    });
}
