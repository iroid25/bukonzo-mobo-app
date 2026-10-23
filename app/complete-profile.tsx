import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/context/AuthContext';
import { DataService } from '@/services/api';
import { assetToUploadFile, useUploadThing } from '@/services/uploadthing';
import { queryClient } from '@/services/queries';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { 
    Platform, 
    Text, 
    TextInput, 
    TouchableOpacity, 
    View, 
    ActivityIndicator,
    ScrollView,
    KeyboardAvoidingView
} from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import Toast from 'react-native-toast-message';

export default function CompleteProfileScreen() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  // If the profile is already complete, this screen was opened from the
  // "Edit Profile" button rather than the mandatory onboarding redirect.
  const isEditMode = !user?.needsProfileCompletion;
  const [isLoading, setIsLoading] = useState(false);
  const [isPrefilling, setIsPrefilling] = useState(isEditMode);

  // Form state
  const [email, setEmail] = useState('');
  const [nin, setNin] = useState('');
  const [surname, setSurname] = useState('');
  const [otherNames, setOtherNames] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState(new Date(2000, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState('MALE');
  const [maritalStatus, setMaritalStatus] = useState('SINGLE');
  const [occupation, setOccupation] = useState('');
  const [citizenship, setCitizenship] = useState('Ugandan');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(user?.name || '');
  const [nokName, setNokName] = useState('');
  const [nokRelationship, setNokRelationship] = useState('');
  const [nokPhone, setNokPhone] = useState('');
  const [profileImage, setProfileImage] = useState<string | null>(user?.image || null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!isEditMode) return;
    const loadExisting = async () => {
      try {
        const res = await DataService.getProfileStatus();
        const d = res.data?.initialData;
        if (!d) return;
        setSurname(d.surname || '');
        setOtherNames(d.otherNames || '');
        setEmail(d.email || '');
        setNin(d.nin || '');
        if (d.dateOfBirth) setDateOfBirth(new Date(d.dateOfBirth));
        setGender(d.gender || 'MALE');
        setMaritalStatus(d.maritalStatus || 'SINGLE');
        setOccupation(d.occupation || '');
        setCitizenship(d.citizenship || 'Ugandan');
        setAddress(d.address || '');
        setPhone(d.phone || '');
        setNokName(d.nokName || '');
        setNokRelationship(d.nokRelationship || '');
        setNokPhone(d.nokPhone || '');
      } catch (e) {
        console.warn('Failed to load existing profile for editing', e);
        Toast.show({ type: 'error', text1: 'Load Failed', text2: 'Could not load your current details' });
      } finally {
        setIsPrefilling(false);
      }
    };
    loadExisting();
  }, [isEditMode]);

  const { startUpload } = useUploadThing("profileImage" as any, {
    onClientUploadComplete: () => {
      setIsUploading(false);
      Toast.show({ type: 'success', text1: 'Upload Complete' });
    },
    onUploadError: (e) => {
      setIsUploading(false);
      Toast.show({ type: 'error', text1: 'Upload Failed', text2: e.message });
    },
  });

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      const previous = profileImage;
      setProfileImage(asset.uri);
      try {
        setIsUploading(true);
        const file = await assetToUploadFile(asset, `profile_${user?.id || 'new'}`);
        const res = await startUpload([file as any]);
        if (res && res[0]?.url) {
          setProfileImage(res[0].url);
        } else {
          throw new Error('Upload did not return a file URL');
        }
      } catch (e: any) {
        console.error("Upload error", e);
        Toast.show({ type: 'error', text1: 'Upload Failed', text2: e.message || 'Could not upload photo' });
        setProfileImage(previous);
      } finally { setIsUploading(false); }
    }
  };

  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const validateForm = () => {
    const errors: Record<string, string[]> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) errors.email = ['Valid email required'];
    if (!nin || nin.length < 5) errors.nin = ['NIN too short'];
    if (!surname) errors.surname = ['Surname required'];
    if (!otherNames) errors.otherNames = ['Other names required'];
    if (!address) errors.address = ['Address required'];
    if (!phone) errors.phone = ['Phone required'];
    if (!nokName) errors.nokName = ['Next of Kin required'];
    if (!nokPhone) errors.nokPhone = ['Next of Kin phone required'];
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) { Toast.show({ type: 'error', text1: 'Validation Error', text2: 'Fix highlighted fields' }); return; }
    setIsLoading(true);
    try {
      await DataService.updateProfile({
        email, nin, surname, otherNames, dateOfBirth: dateOfBirth.toISOString().split('T')[0],
        gender, maritalStatus, occupation: occupation || undefined, citizenship: citizenship || undefined,
        address, phone, nokName, nokRelationship: nokRelationship || undefined, nokPhone, image: profileImage || undefined,
      });
      // Reflect the new photo in the cached profile instantly so Home/Profile
      // paint it without a refetch round-trip; bust the URL so a CDN/proxy
      // holding the previous bytes under the same path can't serve them.
      if (profileImage && !profileImage.startsWith('file:')) {
        const sep = profileImage.includes('?') ? '&' : '?';
        const busted = `${profileImage}${sep}v=${Date.now()}`;
        queryClient.setQueryData(['profile'], (old: any) => (old ? { ...old, image: busted } : old));
      }
      if (isEditMode) {
        Toast.show({ type: 'success', text1: 'Profile Updated' });
        setTimeout(() => router.back(), 800);
      } else {
        Toast.show({ type: 'success', text1: 'Profile Activated!', text2: 'Welcome to the SACCO' });
        setTimeout(() => {
          router.replace(user?.role?.toUpperCase() === 'AGENT' ? '/(agent-tabs)' : '/(tabs)');
        }, 1000);
      }
    } catch (error: any) {
      setFieldErrors(error.response?.data?.fieldErrors || {});
      Toast.show({ type: 'error', text1: 'Update Failed', text2: error.message || 'Try again' });
    } finally { setIsLoading(false); }
  };

  const InputCard = ({ label, icon, value, onChangeText, placeholder, error, keyboardType = 'default', autoCapitalize = 'words' }: any) => (
    <View className="mb-5">
        <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">{label}</Text>
        <View className={`bg-white border rounded-2xl p-4 flex-row items-center shadow-sm ${error ? 'border-red-200' : 'border-gray-100'}`}>
            <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center mr-3">
                <IconSymbol name={icon} size={18} color="#1A6B47" />
            </View>
            <TextInput 
                className="flex-1 text-textDark font-bold text-sm p-0"
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                placeholderTextColor="#8FA99D"
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
            />
        </View>
        {error && <Text className="text-red-500 text-[10px] mt-1 ml-1 font-bold">{error[0]}</Text>}
    </View>
  );

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1 bg-warmWhite">
      <StatusBar style="light" />
      
      {/* Cinematic Header */}
      <View className="bg-forest pt-12 pb-8 overflow-hidden">
          <View className="absolute top-[-30px] right-[-30px] w-56 h-56 bg-mint/5 rounded-full" />
          <View className="px-6 flex-row items-center justify-between">
              <View>
                  <Text className="text-white text-xl font-black tracking-tight">{isEditMode ? 'Edit Profile' : 'Activate Account'}</Text>
                  <Text className="text-white/60 text-[10px] font-bold uppercase tracking-widest mt-1">{isEditMode ? 'Update Your Details' : 'Onboarding Process'}</Text>
              </View>
              {isEditMode ? (
                  <TouchableOpacity onPress={() => router.back()} className="bg-white/10 px-4 py-2 rounded-full border border-white/20">
                      <Text className="text-white text-[10px] font-black uppercase tracking-widest">Cancel</Text>
                  </TouchableOpacity>
              ) : (
                  <TouchableOpacity onPress={signOut} className="bg-white/10 px-4 py-2 rounded-full border border-white/20">
                      <Text className="text-white text-[10px] font-black uppercase tracking-widest">Logout</Text>
                  </TouchableOpacity>
              )}
          </View>
      </View>

      {isPrefilling ? (
        <View className="flex-1 items-center justify-center">
            <ActivityIndicator size="large" color="#1A6B47" />
        </View>
      ) : (
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ padding: 24, paddingBottom: 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Phase Indicator */}
        {!isEditMode && (
        <View className="flex-row items-center mb-10">
            <View className="w-10 h-10 bg-mint rounded-full items-center justify-center"><Text className="text-white font-black">1</Text></View>
            <View className="flex-1 h-[2px] bg-mint/20 mx-2" />
            <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"><Text className="text-textLight font-black">2</Text></View>
            <View className="flex-1 h-[2px] bg-gray-100 mx-2" />
            <View className="w-10 h-10 bg-gray-100 rounded-full items-center justify-center"><Text className="text-textLight font-black">3</Text></View>
        </View>
        )}

        {/* Profile Photo Selection */}
        <View className="items-center mb-12">
            <TouchableOpacity onPress={pickImage} activeOpacity={0.9}>
                <View className="w-32 h-32 rounded-[48px] bg-white shadow-xl shadow-forest/10 border-4 border-white overflow-hidden items-center justify-center">
                    {profileImage ? (
                        <Image source={{ uri: profileImage }} className="w-full h-full" cachePolicy="memory-disk" />
                    ) : (
                        <IconSymbol name="person.fill" size={60} color="#D1D5DB" />
                    )}
                    {isUploading && <View className="absolute inset-0 bg-black/40 items-center justify-center"><ActivityIndicator color="white" /></View>}
                </View>
                <View className="absolute bottom-[-10px] right-[-10px] bg-leaf w-10 h-10 rounded-3xl border-4 border-warmWhite items-center justify-center shadow-lg">
                    <IconSymbol name="camera.fill" size={16} color="white" />
                </View>
            </TouchableOpacity>
            <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mt-6">Identification Photo</Text>
        </View>

        <Text className="text-textDark font-black text-xl mb-6 px-1">Personal Details</Text>
        
        <InputCard label="Public Identity (NIN)" icon="creditcard.fill" value={nin} onChangeText={setNin} placeholder="Enter National ID" error={fieldErrors.nin} autoCapitalize="characters" />
        <View className="flex-row space-x-4">
            <View className="flex-1"><InputCard label="Surname" icon="person.fill" value={surname} onChangeText={setSurname} placeholder="DOE" error={fieldErrors.surname} /></View>
            <View className="flex-1"><InputCard label="Other Names" icon="person.fill" value={otherNames} onChangeText={setOtherNames} placeholder="JOHN" error={fieldErrors.otherNames} /></View>
        </View>

        <View className="mb-5">
            <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">Birth Date</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(true)} className="bg-white border border-gray-100 rounded-2xl p-4 flex-row items-center shadow-sm">
                <View className="w-10 h-10 bg-gray-50 rounded-xl items-center justify-center mr-3">
                    <IconSymbol name="calendar" size={18} color="#1A6B47" />
                </View>
                <Text className="text-textDark font-bold text-sm">{dateOfBirth.toLocaleDateString()}</Text>
            </TouchableOpacity>
            {showDatePicker && <DateTimePicker value={dateOfBirth} mode="date" display="default" onChange={(e, d) => { setShowDatePicker(false); if (d) setDateOfBirth(d); }} />}
        </View>

        <View className="flex-row space-x-4 mb-8">
            <View className="flex-1">
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">Gender</Text>
                <View className="bg-white border border-gray-100 rounded-2xl overflow-hidden h-14 shadow-sm">
                    <Picker selectedValue={gender} onValueChange={setGender} style={{ flex: 1 }}><Picker.Item label="Male" value="MALE" /><Picker.Item label="Female" value="FEMALE" /></Picker>
                </View>
            </View>
            <View className="flex-1">
                <Text className="text-textLight text-[10px] font-black uppercase tracking-widest mb-2 px-1">Status</Text>
                <View className="bg-white border border-gray-100 rounded-2xl overflow-hidden h-14 shadow-sm">
                    <Picker selectedValue={maritalStatus} onValueChange={setMaritalStatus} style={{ flex: 1 }}><Picker.Item label="Single" value="SINGLE" /><Picker.Item label="Married" value="MARRIED" /></Picker>
                </View>
            </View>
        </View>

        <Text className="text-textDark font-black text-xl mb-6 mt-4 px-1">Contact & Security</Text>
        <InputCard label="Official Email" icon="envelope.fill" value={email} onChangeText={setEmail} placeholder="your@email.com" error={fieldErrors.email} keyboardType="email-address" autoCapitalize="none" />
        <InputCard label="Residential Address" icon="map.fill" value={address} onChangeText={setAddress} placeholder="Street, City" error={fieldErrors.address} />
        
        <Text className="text-textDark font-black text-xl mb-6 mt-4 px-1">Next of Kin</Text>
        <InputCard label="Full Name" icon="person.fill" value={nokName} onChangeText={setNokName} placeholder="Kin Name" error={fieldErrors.nokName} />
        <InputCard label="Phone Number" icon="phone" value={nokPhone} onChangeText={setNokPhone} placeholder="+256..." error={fieldErrors.nokPhone} keyboardType="phone-pad" />

      </ScrollView>
      )}

      {/* Floating Action Bar */}
      {!isPrefilling && (
      <View className="absolute bottom-0 left-0 right-0 bg-white/80 backdrop-blur-xl p-6 border-t border-gray-100 shadow-2xl">
          <TouchableOpacity onPress={handleSubmit} disabled={isLoading} className="bg-leaf h-16 rounded-[24px] items-center justify-center flex-row shadow-xl shadow-leaf/20">
              {isLoading ? <ActivityIndicator color="white" /> : (
                  <>
                      <Text className="text-white font-black text-base uppercase tracking-widest mr-4">{isEditMode ? 'Save Changes' : 'Complete Activation'}</Text>
                      <View className="w-8 h-8 bg-white/20 rounded-full items-center justify-center"><IconSymbol name="arrow.right" size={16} color="white" /></View>
                  </>
              )}
          </TouchableOpacity>
      </View>
      )}
    </KeyboardAvoidingView>
  );
}
