package com.biopeakai.performance;

import android.os.Parcel;
import android.os.Parcelable;

public class LocationData implements Parcelable {
    public double latitude;
    public double longitude;
    public float accuracy;
    public double altitude;
    public float speed;
    public float heading;
    public float distanceIncrement;
    public double totalDistance;
    public long timestamp;
    
    public LocationData() {}
    
    protected LocationData(Parcel in) {
        latitude = in.readDouble();
        longitude = in.readDouble();
        accuracy = in.readFloat();
        altitude = in.readDouble();
        speed = in.readFloat();
        heading = in.readFloat();
        distanceIncrement = in.readFloat();
        totalDistance = in.readDouble();
        timestamp = in.readLong();
    }
    
    @Override
    public void writeToParcel(Parcel dest, int flags) {
        dest.writeDouble(latitude);
        dest.writeDouble(longitude);
        dest.writeFloat(accuracy);
        dest.writeDouble(altitude);
        dest.writeFloat(speed);
        dest.writeFloat(heading);
        dest.writeFloat(distanceIncrement);
        dest.writeDouble(totalDistance);
        dest.writeLong(timestamp);
    }
    
    @Override
    public int describeContents() {
        return 0;
    }
    
    public static final Creator<LocationData> CREATOR = new Creator<LocationData>() {
        @Override
        public LocationData createFromParcel(Parcel in) {
            return new LocationData(in);
        }
        
        @Override
        public LocationData[] newArray(int size) {
            return new LocationData[size];
        }
    };
}
