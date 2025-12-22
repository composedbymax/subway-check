```
MP""""""`MM M""MMMMM""M M#"""""""'M  M""MMM""MMM""M MMP"""""""MM M""MMMM""M 
M  mmmmm..M M  MMMMM  M ##  mmmm. `M M  MMM  MMM  M M' .mmmm  MM M. `MM' .M 
M.      `YM M  MMMMM  M #'        .M M  MMP  MMP  M M         `M MM.    .MM 
MMMMMMM.  M M  MMMMM  M M#  MMMb.'YM M  MM'  MM' .M M  MMMMM  MM MMMb  dMMM 
M. .MMM'  M M  `MMM'  M M#  MMMM'  M M  `' . '' .MM M  MMMMM  MM MMMM  MMMM 
Mb.     .dM Mb       dM M#       .;M M    .d  .dMMM M  MMMMM  MM MMMM  MMMM 
MMMMMMMMMMM MMMMMMMMMMM M#########M  MMMMMMMMMMMMMM MMMMMMMMMMMM MMMMMMMMMM 
                                                                            
MM'""""'YMM M""MMMMM""MM MM""""""""`M MM'""""'YMM M""MMMMM""M               
M' .mmm. `M M  MMMMM  MM MM  mmmmmmmM M' .mmm. `M M  MMMM' .M               
M  MMMMMooM M         `M M`      MMMM M  MMMMMooM M       .MM               
M  MMMMMMMM M  MMMMM  MM MM  MMMMMMMM M  MMMMMMMM M  MMMb. YM               
M. `MMM' .M M  MMMMM  MM MM  MMMMMMMM M. `MMM' .M M  MMMMb  M               
MM.     .dM M  MMMMM  MM MM        .M MM.     .dM M  MMMMM  M               
MMMMMMMMMMM MMMMMMMMMMMM MMMMMMMMMMMM MMMMMMMMMMM MMMMMMMMMMM   
```


## Data Sources

This app uses official **MTA Subway GTFS-Realtime feeds**:

- **MTA Stops**  
  https://www.mta.info/developers

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
