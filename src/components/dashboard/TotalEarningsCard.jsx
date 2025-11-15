import React from 'react';
import { useData } from '../../hooks/useData'
import { Skeleton } from '@chakra-ui/react'; // Assuming you use Chakra for loading skeletons

const TotalEarningsCard = () => {
  const { totalEarningsData, loading } = useData();

  const totalEarnings = totalEarningsData?.total || 0;

  return (
    <Skeleton isLoaded={!loading.totalEarnings} borderRadius="24px">
      <div style={styles.card}>
        <h3 style={styles.title}>Total Actual Earnings</h3>
        <p style={styles.value}>
          LKR {Math.round(totalEarnings).toLocaleString()}
        </p>
        <p style={styles.subtitle}>All-time earnings from CEB</p>
      </div>
    </Skeleton>
  );
};

// Add your component-specific styles here
const styles = {
  card: { /* Your card styles */ },
  title: { /* Your title styles */ },
  value: { /* Your value styles */ },
  subtitle: { /* Your subtitle styles */ },
};

export default TotalEarningsCard;