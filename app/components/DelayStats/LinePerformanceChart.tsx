'use client';

import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface TimelineData {
  date: string;
  avgDelay: number;
  onTimeRate: number;
}

interface LinePerformanceChartProps {
  data: TimelineData[];
}

const LinePerformanceChart: React.FC<LinePerformanceChartProps> = ({ data }) => {
  // Formater les données pour l'affichage
  const formattedData = data.map(item => ({
    ...item,
    onTimeRate: item.onTimeRate * 100 // Convertir en pourcentage pour l'affichage
  }));
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={formattedData}
        margin={{
          top: 5,
          right: 10,
          left: 0,
          bottom: 5,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="date" />
        <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
        <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" domain={[0, 100]} />
        <Tooltip formatter={(value, name) => {
          if (name === 'onTimeRate') return [Number(value).toFixed(1) + '%', 'Taux de ponctualité'];
          if (name === 'avgDelay') return [Number(value).toFixed(1) + ' sec', 'Retard moyen'];
          return [value, name];
        }} />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="avgDelay"
          name="Retard moyen"
          stroke="#8884d8"
          activeDot={{ r: 8 }}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="onTimeRate"
          name="Taux de ponctualité"
          stroke="#82ca9d"
        />
      </LineChart>
    </ResponsiveContainer>
  );
};

export default LinePerformanceChart;