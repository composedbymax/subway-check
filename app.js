(async () => {
  const root = await protobuf.load("gtfs-realtime.proto");
  const FeedMessage = root.lookupType("transit_realtime.FeedMessage");
  const res = await fetch("feed.php");
  const buffer = await res.arrayBuffer();
  const message = FeedMessage.decode(new Uint8Array(buffer));
  const feed = FeedMessage.toObject(message, {
    longs: Number,
    enums: String,
    defaults: true
  });
  console.log(feed);
  const trips = feed.entity
    .filter(e => e.tripUpdate)
    .map(e => e.tripUpdate);
  console.log("Trips:", trips);
})();