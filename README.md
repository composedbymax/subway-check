# NYC Subway Realtime App


## Data Sources

This app uses official **MTA Subway GTFS-Realtime feeds**:

- **MTA Realtime Feeds**  
  https://api.mta.info/#/subwayRealTimeFeeds

- **Terms & Conditions**  
  https://www.mta.info/developers/terms-and-conditions

### Subway Line Feeds

| Lines | Feed URL |
|-----|---------|
| ACE | https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-ace |
| G | https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-g |
| N Q R W | https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-nqrw |
| 1 2 3 4 5 6 7 S | https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs |
| B D F M | https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-bdfm |
| J Z | https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-jz |
| L | https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/nyct%2Fgtfs-l |

---

## Dependencies

### JavaScript Libraries
- **protobuf.js** — Used to decode GTFS-Realtime Protobuf data  
  - CDN: https://cdn.jsdelivr.net/npm/protobufjs@7.X.X/dist/protobuf.min.js

### GTFS Realtime Specification
- **GTFS Realtime Protobuf**
  - Definition file: `gtfs-realtime.proto`
  - Documentation: https://gtfs.org/documentation/realtime/proto/


## Disclaimer

This project is **not affiliated with the MTA**. Subway data is provided by the Metropolitan Transportation Authority under their developer terms.
