# IMI live provider adapter — decision record

Checked: 19 November 2026. Prices are indicative USD list prices and may change. No provider was selected, no account was created, and no service was purchased.

| Provider | Fit | Indicative cost | Complexity / trade-offs |
|---|---|---|---|
| LiveKit self-hosted | Interactive audio/video rooms, data messages, lifecycle; strong fit for classrooms | Open-source Apache 2.0 server has no licence fee; compute, bandwidth, TURN, recording, monitoring and operations are extra | Highest operations burden: maintain SFU, TLS, TURN, scaling, recording, monitoring and security updates |
| Cloudflare Stream | Managed live ingest/playback and video storage/recording | $5 per 1,000 stored minutes/month; $1 per 1,000 delivered minutes. Ingress and encoding free. WebRTC delivery billable since 15 Oct 2026 | Low-to-medium operations; strong video lifecycle. Classroom chat, moderation, hand-raising and teacher controls remain app work |
| Agora Interactive Live Streaming | Managed low-latency real-time video/voice | Free tier 10,000 standard participant minutes/month; Starter listed $45.99/month for 50,000 minutes. Participant-minute pricing; Cloud Proxy can add minimum fees | Medium SDK integration; model participant minutes and proxy/network fees carefully |
| Mux | Managed live and VOD ingest/encoding/delivery | Pay-as-you-go includes $20 monthly usage credit and 100K delivery minutes free; 720p Plus live input starts $0.025/min, with storage/delivery billed separately | Low-to-medium operations; strong recording/VOD lifecycle, but interactive classroom controls/chat are separate |

## Official references

- LiveKit server Apache 2.0: https://github.com/livekit/livekit
- LiveKit self-hosting: https://docs.livekit.io/transport/self-hosting/
- LiveKit Cloud pricing: https://livekit.com/pricing
- Cloudflare Stream pricing: https://developers.cloudflare.com/stream/pricing/
- Agora Interactive Live Streaming pricing: https://www.agora.io/en/pricing/interactive-live-streaming/
- Mux pricing: https://www.mux.com/pricing

## Recommendation (not a provider selection)

Keep the adapter and mock as the only active implementation for now. If IMI can maintain infrastructure and on-call operations, evaluate LiveKit self-hosted first for interactive classrooms. If that operational capacity is unavailable, compare Agora and Cloudflare Stream in a controlled latency/cost proof of concept; Agora is more naturally oriented to interactive RTC, while Cloudflare offers a simpler stored/delivered-minute video pipeline. Treat Mux mainly as a strong recording/VOD candidate until live interaction is validated.

## Adapter contract

- create/schedule/cancel room;
- issue short-lived room-scoped participant tokens server-side;
- start/end room and publish lifecycle events;
- subscribe to room state and participant presence;
- moderated chat, pinned questions, hand-raising and polls;
- start/stop recording and receive recording-ready callbacks;
- map provider errors and quality metrics into provider-neutral events.

The mock must never display a real join URL or claim a real broadcast is running. Real provider configuration and live testing require explicit approval.
