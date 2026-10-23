import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, TouchableOpacityProps, View } from 'react-native';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
  icon?: React.ReactNode;
}

export const Button = ({ title, variant = 'primary', isLoading, icon, className, ...props }: ButtonProps) => {
  // Premium Styles
  const baseStyles = "py-4 px-6 rounded-xl flex-row items-center justify-center shadow-sm";
  
  const variants = {
    primary: "bg-green-600 border border-green-600 shadow-green-200",
    secondary: "bg-blue-600 border border-blue-600 shadow-blue-200",
    outline: "bg-transparent border-2 border-green-600",
    ghost: "bg-transparent shadow-none",
  };
  
  const textStyles = {
    primary: "text-white font-bold text-lg tracking-wide",
    secondary: "text-white font-bold text-lg tracking-wide",
    outline: "text-green-600 font-bold text-lg tracking-wide",
    ghost: "text-gray-600 font-medium text-base",
  };

  return (
    <TouchableOpacity 
      activeOpacity={0.8}
      className={`${baseStyles} ${variants[variant]} ${isLoading ? 'opacity-80' : ''} ${className}`}
      disabled={isLoading || props.disabled}
      {...props}
    >
      {isLoading ? (
        <ActivityIndicator color={variant === 'outline' || variant === 'ghost' ? '#16a34a' : 'white'} />
      ) : (
        <>
            {icon && <View className="mr-2">{icon}</View>}
            <Text className={textStyles[variant]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};
