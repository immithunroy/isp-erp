import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { StatusBar } from "expo-status-bar";
import { AuthProvider, useAuth } from "./src/store/auth";
import { SyncProvider } from "./src/store/sync";
import { LoginScreen } from "./src/screens/LoginScreen";
import { DashboardScreen } from "./src/screens/DashboardScreen";
import { AttendanceScreen } from "./src/screens/AttendanceScreen";
import { GPSScreen } from "./src/screens/GPSScreen";
import { ProfileScreen } from "./src/screens/ProfileScreen";
import { JobsScreen } from "./src/screens/JobsScreen";
import { CustomerListScreen } from "./src/screens/CustomerListScreen";
import { CustomerDetailScreen } from "./src/screens/CustomerDetailScreen";
import { CustomerLocationScreen } from "./src/screens/CustomerLocationScreen";
import { NetworkAssetScreen } from "./src/screens/NetworkAssetScreen";
import { TJBoxScreen } from "./src/screens/TJBoxScreen";
import { EnclosureScreen } from "./src/screens/EnclosureScreen";
import { SplitterScreen } from "./src/screens/SplitterScreen";
import { FiberSurveyScreen } from "./src/screens/FiberSurveyScreen";
import { PhotoCaptureScreen } from "./src/screens/PhotoCaptureScreen";
import { EquipmentScanScreen } from "./src/screens/EquipmentScanScreen";
import { JobCompletionScreen } from "./src/screens/JobCompletionScreen";
import { NotificationsScreen } from "./src/screens/NotificationsScreen";
import { ActivityIndicator, View, Text } from "react-native";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator screenOptions={{ tabBarActiveTintColor: "#0ea5e9" }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ title: "Home" }}
      />
      <Tab.Screen
        name="Attendance"
        component={AttendanceScreen}
        options={{ title: "Attendance" }}
      />
      <Tab.Screen name="GPS" component={GPSScreen} options={{ title: "GPS" }} />
      <Tab.Screen name="Jobs" component={JobsScreen} options={{ title: "Jobs" }} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: "Profile" }}
      />
    </Tab.Navigator>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#0ea5e9" />
        <Text style={{ marginTop: 12, color: "#64748b" }}>Loading...</Text>
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen
              name="CustomerDetail"
              component={CustomerDetailScreen}
              options={{ title: "Customer", headerShown: true }}
            />
            <Stack.Screen
              name="CustomerLocation"
              component={CustomerLocationScreen}
              options={{ title: "Location Capture", headerShown: true }}
            />
            <Stack.Screen
              name="NetworkAsset"
              component={NetworkAssetScreen}
              options={{ title: "Network Asset", headerShown: true }}
            />
            <Stack.Screen
              name="TJBox"
              component={TJBoxScreen}
              options={{ title: "TJ Box", headerShown: true }}
            />
            <Stack.Screen
              name="Enclosure"
              component={EnclosureScreen}
              options={{ title: "Enclosure", headerShown: true }}
            />
            <Stack.Screen
              name="Splitter"
              component={SplitterScreen}
              options={{ title: "Splitter", headerShown: true }}
            />
            <Stack.Screen
              name="FiberSurvey"
              component={FiberSurveyScreen}
              options={{ title: "Fiber Survey", headerShown: true }}
            />
            <Stack.Screen
              name="PhotoCapture"
              component={PhotoCaptureScreen}
              options={{ title: "Photo", headerShown: true }}
            />
            <Stack.Screen
              name="EquipmentScan"
              component={EquipmentScanScreen}
              options={{ title: "Equipment", headerShown: true }}
            />
            <Stack.Screen
              name="JobCompletion"
              component={JobCompletionScreen}
              options={{ title: "Complete Job", headerShown: true }}
            />
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{ title: "Notifications", headerShown: true }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <SyncProvider>
        <AppNavigator />
        <StatusBar style="auto" />
      </SyncProvider>
    </AuthProvider>
  );
}