import Colors from '@/constants/colors';
import { StyleSheet, Text, View } from "react-native";

const StatusDashboard = () => {
  return (
    <View style={styles.statusContainer}>
      <View style={styles.statusIndicator}></View>
      <Text style={styles.statusText}>System Online</Text>
    </View>
  );
};

export default StatusDashboard;

const styles = StyleSheet.create({
  statusContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusIndicator: {
    width: 10,
    height: 10,
    backgroundColor: Colors.healthy,
    borderRadius: 5,
  },
  statusText: {
    color: Colors.primary,
    fontWeight: "600",
    fontSize: 13,
  },
});