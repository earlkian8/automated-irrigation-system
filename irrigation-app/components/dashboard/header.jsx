import Colors from '@/constants/colors';
import { StyleSheet, Text } from "react-native";

const HeaderDashboard = () => {
  return (
    <>
      <Text style={styles.title}>Dashboard</Text>
      <Text style={styles.subtitle}>Your garden status</Text>
    </>
  );
};

export default HeaderDashboard;

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 15, color: Colors.textSecondary, marginBottom: 0 },
});