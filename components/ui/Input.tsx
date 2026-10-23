import React from 'react';
import { Text, TextInput, TextInputProps, View } from 'react-native';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
}

export const Input = ({ label, error, className, ...props }: InputProps) => {
  return (
    <View className="mb-5">
      {label && <Text className="text-gray-700 mb-2 font-semibold text-sm tracking-wide ml-1">{label}</Text>}
      <TextInput
        className={`w-full bg-white border ${error ? 'border-red-500' : 'border-gray-200'} rounded-xl px-4 py-4 text-gray-800 text-base shadow-sm focus:border-green-500 focus:shadow-green-100 ${className}`}
        placeholderTextColor="#9ca3af"
        {...props}
      />
      {error && <Text className="text-red-500 text-xs mt-1 ml-1 font-medium">{error}</Text>}
    </View>
  );
};
