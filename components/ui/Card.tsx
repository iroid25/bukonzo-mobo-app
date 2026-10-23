import React from 'react';
import { View, ViewProps } from 'react-native';

interface CardProps extends ViewProps {
    variant?: 'default' | 'elevated' | 'flat';
}

export const Card = ({ children, className, variant = 'default', ...props }: CardProps) => {
  const variants = {
     default: "bg-white shadow-sm border border-gray-100",
     elevated: "bg-white shadow-lg shadow-gray-100 border-0 elevation-5",
     flat: "bg-gray-50 border-0"
  }

  return (
    <View 
      className={`${variants[variant]} rounded-2xl p-5 ${className}`}
      {...props}
    >
      {children}
    </View>
  );
};
