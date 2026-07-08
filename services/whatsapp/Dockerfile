FROM golang:1.22-alpine AS build
WORKDIR /src
COPY . .
RUN go build -o /whatsapp
FROM alpine:3.20
COPY --from=build /whatsapp /whatsapp
EXPOSE 8081
CMD ["/whatsapp"]
