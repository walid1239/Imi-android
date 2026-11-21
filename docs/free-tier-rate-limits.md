# IMI Spark rate-limit write budget

The server keeps one apiRateLimits document per user and API operation, keyed by
SHA-256(operation:uid). Each successful API mutation performs one additional Firestore write
to that document, regardless of how many windows apply. In particular, sendFriendRequest stores
its hourly and daily counters inside one document and no longer writes two separate counter
documents. Rejected requests do not write a counter because the transaction aborts before the write.

The Spark Firestore daily write quota is 20,000 writes. This counter overhead is therefore one
write per successful API request, in addition to the domain writes performed by that operation.
For example, a status publication costs at least two writes (one rate-limit reservation and one
status document); conversation/friend operations may cost more depending on their transaction.
The safe daily API volume is consequently not a fixed number: subtract all non-rate-limit writes
from 20,000, then account for the domain writes per operation. Counter documents are updated in
place when windows reset, so they do not create one document per request and need no TTL job.
Firestore rules explicitly deny client access to apiRateLimits; only the Admin SDK can read or
change these records.
