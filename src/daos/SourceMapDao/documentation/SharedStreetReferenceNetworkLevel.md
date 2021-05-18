<!-- markdownlint-disable MD013 MD022 MD034 -->

TODO: Note first section describing the problem is incomplete.
      Need to fully grok the relationships between
        Way, SharedStreetsOSMMetadata, and SharedStreetsGeometry roadClass.

# SharedStreetsGeometry RoadClass assignment and consequences for SharedStreets Matching

When serializing the SharedStreetsGeometry, roadClass is determined by
  *SharedStreetsOSMMetadata.getRoadClass()*, which assigns *ROAD_CLASS.ClassOther*
  if the roadClass is inconsistent across waySections.

SharedStreetsGeometry constructor takes a BaseSegment.
  The BaseSegment is used to create the SharedStreetsGeometry.metadata field
  that is of type SharedStreetsOSMMetadata.

However, in *BaseSegment.getRoadClass()*, roadClass is the lowest roadClass across the waySections.
  BaseSegment is created with a single WaySection and possibly later merged with others to create
    a BaseSegment comprised of multiple WaySections.

The result is that SharedStreetsGeometries comprised of OSM WaySections
  with inconsistent RoadClasses are ignored during matching.
  This RoadClass inconsistency can happen with network critical segments,
  such as segments along the Taconic State Parkway where the RoadClass
  alternates between Motorway and Trunk.

There appears to be an inconsistency in SharedStreets' handling of inconsistent OSM Way RoadClasses.

In the *sharedstreets/tools/builder/model/BaseSegment*, 

**NOTE: SharedStreetsGeometries with roadClass === 'Other'
  are ignored during SharedStreets matching
  for all but the GraphMode.BIKE and GraphMode.PEDESTRIAN**

## OSM Tags

* [Highways](https://wiki.openstreetmap.org/wiki/Highways)

* [Key:highway](https://wiki.openstreetmap.org/wiki/Key:highway)
  * [Roads](https://wiki.openstreetmap.org/wiki/Key:highway#Roads)

## SharedStreetsGeometry RoadClass

### [sharedstreets-builder/src/main/java/io/sharedstreets/data/SharedStreetsGeometry.java](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/data/SharedStreetsGeometry.java)

**NOTE: RoadClass assigned in the ShstTileset is ROAD_CLASS.ClassOther if OSM Ways RoadClasses are inconsistent.**

#### [public SharedStreetsGeometry(BaseSegment segment)](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/data/SharedStreetsGeometry.java#L40-L49)

```java
public SharedStreetsGeometry(BaseSegment segment) {

    this.geometry = segment.constructGeometry();
    this.length = GeoOp.length((Polyline)this.geometry);;

    this.id = SharedStreetsGeometry.generateId(this);


    this.metadata = new SharedStreetsOSMMetadata(this, segment);
}
```

#### [public byte[] toBinary()](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/data/SharedStreetsGeometry.java#L55-L81)

```java
geometryBuilder.setRoadClass(SharedStreetsProto.RoadClass.forNumber(this.metadata.getRoadClass().getValue()));
```

from

```java
public byte[] toBinary() throws IOException {

    SharedStreetsProto.SharedStreetsGeometry.Builder geometryBuilder = SharedStreetsProto.SharedStreetsGeometry.newBuilder();
    geometryBuilder.setId(this.id.toString());

    geometryBuilder.setFromIntersectionId(this.startIntersectionId.toString());
    geometryBuilder.setToIntersectionId(this.endIntersectionId.toString());

    geometryBuilder.setForwardReferenceId(this.forwardReferenceId.toString());

    if(this.backReferenceId != null)
        geometryBuilder.setBackReferenceId(this.backReferenceId.toString());

    geometryBuilder.setRoadClass(SharedStreetsProto.RoadClass.forNumber(this.metadata.getRoadClass().getValue()));

    for(int i = 0; i < ((Polyline)geometry).getPointCount(); i++) {

        geometryBuilder.addLonlats(((Polyline)geometry).getPoint(i).getX()); // lon
        geometryBuilder.addLonlats(((Polyline)geometry).getPoint(i).getY()); // lat

    }

    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    geometryBuilder.build().writeDelimitedTo(bytes);

    return bytes.toByteArray();
}
```

**NOTE: SharedStreetsGeometries with roadClass === 'Other'
  are ignored during SharedStreets matching
  for all but the GraphMode.BIKE and GraphMode.PEDESTRIAN**

### [sharedstreets-js/src/graph.ts](https://github.com/sharedstreets/sharedstreets-js/blob/98f8b78d0107046ed2ac1f681cff11eb5a356474/src/graph.ts)

#### [async createGraphXml()](https://github.com/sharedstreets/sharedstreets-js/blob/98f8b78d0107046ed2ac1f681cff11eb5a356474/src/graph.ts#L547-L562)

```java
if(obj.roadClass == 'Motorway') {
    if(this.graphMode != GraphMode.CAR_ALL && this.graphMode != GraphMode.CAR_MOTORWAY_ONLY) {
        continue;
    }
} 
else {
    if(this.graphMode == GraphMode.CAR_MOTORWAY_ONLY) {
        continue;
    }
}

if(obj.roadClass == 'Other') {
    if(this.graphMode != GraphMode.BIKE && this.graphMode != GraphMode.PEDESTRIAN) {
        continue;
    }
}
```

## Appendix

### SharedStreetsBuilder Parsing the OSM Way Tags

#### [sharedstreets-builder/src/main/java/io/sharedstreets/tools/builder/osm/model/Way.java](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/tools/builder/osm/model/Way.java)

##### [public enum Way.ROAD_CLASS](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/tools/builder/osm/model/Way.java##L7-L29)

```java
public enum ROAD_CLASS {

    ClassMotorway(0),
    ClassTrunk(1),
    ClassPrimary(2),
    ClassSecondary(3),
    ClassTertiary(4),
    ClassResidential(5),
    ClassUnclassified(6),
    ClassService(7),
    ClassOther(8);

    private final int value;

    ROAD_CLASS(final int newValue) {
        value = newValue;
    }

    public int getValue() {
        return value;
    }

}
```

##### [public ROAD_CLASS roadClass()](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/tools/builder/osm/model/Way.java##L61-L94)

```java
public ROAD_CLASS roadClass() {

    if (fields.containsKey("highway") && fields.get("highway").toLowerCase().trim().startsWith("motorway"))
        return ROAD_CLASS.ClassMotorway;
    else if (fields.containsKey("highway") && fields.get("highway").toLowerCase().trim().startsWith("trunk"))
        return ROAD_CLASS.ClassTrunk;
    else if (fields.containsKey("highway") && fields.get("highway").toLowerCase().trim().startsWith("primary"))
        return ROAD_CLASS.ClassPrimary;
    else if (fields.containsKey("highway") && fields.get("highway").toLowerCase().trim().startsWith("secondary"))
        return ROAD_CLASS.ClassSecondary;
    else if (fields.containsKey("highway") && fields.get("highway").toLowerCase().trim().startsWith("tertiary"))
        return ROAD_CLASS.ClassTertiary;
    else if (fields.containsKey("highway") && fields.get("highway").toLowerCase().trim().startsWith("unclassified"))
        return ROAD_CLASS.ClassUnclassified;
    else if (fields.containsKey("highway") && fields.get("highway").toLowerCase().trim().startsWith("residential"))
        return ROAD_CLASS.ClassResidential;
    else if (fields.containsKey("highway") && fields.get("highway").toLowerCase().trim().startsWith("service")) {

        // attempt to exclude parking lots, driveways and other private driveways to keep just public services roads
        // not consistently mapped in OSM... https://taginfo.openstreetmap.org/keys/?key=service##values
        if (fields.containsKey("service") && (fields.get("service").toLowerCase().trim().startsWith("parking") ||
                fields.get("service").toLowerCase().trim().startsWith("driveway") ||
                fields.get("service").toLowerCase().trim().startsWith("drive-through")))
            return ROAD_CLASS.ClassOther;
        else
            return ROAD_CLASS.ClassService;


    }
    else if (fields.containsKey("highway") && fields.get("highway").toLowerCase().trim().startsWith("living_street"))
        return ROAD_CLASS.ClassResidential;
    else
        return ROAD_CLASS.ClassOther;
}
```

### SharedStreets Domain/Types

#### [sharedstreets-builder/src/main/java/io/sharedstreets/tools/builder/model/BaseSegment.java](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/tools/builder/model/BaseSegment.java)

##### [public Way.ROAD_CLASS getRoadClass()](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/tools/builder/model/BaseSegment.java##L119-L141)

**NOTE: If roadClass across sections is inconsistent, lowest network class assigned.**

```java
public Way.ROAD_CLASS getRoadClass() {

    Way.ROAD_CLASS roadClass = null;

    for(WaySection waySection : this.waySections) {
        if(roadClass == null || roadClass == waySection.roadClass)
            roadClass = waySection.roadClass;

        // if mixed segment make segment class equal lowest class
        // per https://github.com/sharedstreets/sharedstreets-ref-system/issues/20##issuecomment-378079937
        //               [excluded road]
        //                        |
        //    [highway=primary]   |  [highway=secondary]
        //    ====================*=====================
        //               [roadClass=secondary]

        else if(waySection.roadClass.getValue() > roadClass.getValue()){
            roadClass = waySection.roadClass;
            break;
        }
    }
    return roadClass;
}
```

#### [sharedstreets-builder/src/main/java/io/sharedstreets/tools/builder/model/WaySection.java](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/tools/builder/model/WaySection.java)

##### [public class WaySection](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/tools/builder/model/WaySection.java##L7-L18)

```java
public class WaySection {

    public Long wayId;
    public String name;
    public boolean oneWay;
    public boolean roundabout;
    public boolean link;
    public Way.ROAD_CLASS roadClass;

    public NodePosition[] nodes;
}
```

#### [sharedstreets-builder/src/main/java/io/sharedstreets/data/SharedStreetsOSMMetadata.java](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/data/SharedStreetsOSMMetadata.java)

##### [public class WaySectionMetadata](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/data/SharedStreetsOSMMetadata.java##L19-L46)

```java
public class WaySectionMetadata implements Serializable {

    public Long wayId;
    public Way.ROAD_CLASS roadClass;
    public Boolean oneWay;
    public Boolean roundabout;
    public Boolean link;
    public Long[] nodeIds;
    public String name;

    public WaySectionMetadata( WaySection section, boolean storeWaySegmentNames) {
        this.wayId = section.wayId;

        this.roadClass = section.roadClass;
        this.oneWay = section.oneWay;
        this.roundabout = section.roundabout;
        this.link = section.link;

        if(storeWaySegmentNames)
            this.name = section.name;

        this.nodeIds = new Long[section.nodes.length];

        for(int i = 0; i < section.nodes.length; i++) {
            this.nodeIds[i] = section.nodes[i].nodeId;
        }
    }
}
```

##### [public SharedStreetsOSMMetadata](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/data/SharedStreetsOSMMetadata.java##L95-L124)

```java
public SharedStreetsOSMMetadata(SharedStreetsGeometry geometry, BaseSegment segment) {

    this.geometryId = geometry.id; // keeping reference for point data

    waySections = new WaySectionMetadata[segment.waySections.length];

    // store WaySegement names only if more than one segment or segments with different names
    boolean storeWaySegmentNames = false;
    String lastSegmentName = null;
    for(WaySection waySection : segment.waySections) {

        if(lastSegmentName == null) {
            lastSegmentName = waySection.name;
        }
        else {
            if(!lastSegmentName.equals(waySection.name))
                storeWaySegmentNames = true;
        }
    }

    if(!storeWaySegmentNames)
        this.name = lastSegmentName;


    int i = 0;
    for(WaySection section : segment.waySections) {
        waySections[i] = new WaySectionMetadata(section, storeWaySegmentNames);
        i++;
    }
}
```

##### [public Way.ROAD_CLASS getRoadClass](https://github.com/sharedstreets/sharedstreets-builder/blob/a554983e96010d32b71d7d23504fa88c6fbbad10/src/main/java/io/sharedstreets/data/SharedStreetsOSMMetadata.java##L134-L147)

**NOTE: If roadClass across sections is inconsistent, ROAD_CLASS.ClassOther is assigned.**

```java
public Way.ROAD_CLASS getRoadClass() {

    Way.ROAD_CLASS roadClass = null;

    for(WaySectionMetadata waySection : this.waySections) {
        if(roadClass == null || roadClass == waySection.roadClass)
            roadClass = waySection.roadClass;
        else {
            roadClass = Way.ROAD_CLASS.ClassOther;
            break;
        }
    }
    return roadClass;
}
```
