import { IconSymbol } from '@/components/ui/icon-symbol';
import { useMemberSearch } from '@/services/queries';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { 
    ActivityIndicator, 
    ScrollView,
    SectionList,
    Text, 
    TextInput, 
    TouchableOpacity, 
    View,
    Dimensions
} from 'react-native';
import { StatusBar } from 'expo-status-bar';

const { width } = Dimensions.get('window');

const fmt = (n: number) =>
  new Intl.NumberFormat('en-UG', { style: 'decimal', minimumFractionDigits: 0 }).format(n || 0);

const normalizeMember = (item: any) => {
    const name = item.name 
        || item.member?.name 
        || item.user?.name
        || [item.firstName, item.lastName].filter(Boolean).join(' ')
        || [item.surname, item.otherNames].filter(Boolean).join(' ')
        || [item.member?.surname, item.member?.otherNames].filter(Boolean).join(' ')
        || 'Unknown Member';
    const phone = item.phone || item.member?.phone || item.user?.phone || item.phoneNumber || '';
    const memberNumber = item.memberNumber || item.member?.memberNumber || '';
    const memberId = item.member?.id || item.memberId || item.id;
    const userId = item.user?.id || item.userId || item.id;
    const status = item.status || item.member?.status || 'ACTIVE';
    const accounts = item.accounts || item.member?.accounts || [];
    const accountCount = accounts.length || item.accountCount || 0;
    const zone = item.zone || item.branch?.name || item.member?.branch?.name || '';
    const image = item.image || item.member?.image || item.user?.image || item.photo || item.member?.photo || item.user?.photo || null;
    const initials = name.split(' ').map((w: string) => w.charAt(0)).join('').substring(0, 2).toUpperCase();

    return { name, phone, memberNumber, memberId, userId, status, accountCount, accounts, zone, image, initials, _raw: item };
};

export default function MemberSearchScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ mode?: string }>();
    const mode = params.mode === 'withdraw' ? 'withdraw' : params.mode === 'deposit' ? 'deposit' : 'deposit';
    const [query, setQuery] = useState('');
    const [debounced, setDebounced] = useState('');
    const [activeFilter, setActiveFilter] = useState('All Members');

    const filters = ['All Members', 'Active', 'Multi-Account'];

    // Debounce the input before it reaches the cached query hook.
    useEffect(() => {
        const t = setTimeout(() => setDebounced(query.trim()), 250);
        return () => clearTimeout(t);
    }, [query]);

    // Cached, deduplicated lookup: retyping a known name paints instantly
    // (60s staleTime) while still syncing with the server in the background.
    const { data: rawMembers, isFetching } = useMemberSearch(debounced);
    const loading = isFetching && debounced.length >= 2;
    const members = useMemo(
        () => (rawMembers as any[] | undefined)?.map(normalizeMember) ?? [],
        [rawMembers]
    );

    // Apply filters
    const filteredMembers = members.filter(m => {
        if (activeFilter === 'Active') return m.status?.toUpperCase() === 'ACTIVE';
        if (activeFilter === 'Multi-Account') return m.accountCount > 1;
        return true;
    }).filter(m => {
        if (debounced.length < 2) return true;
        const q = debounced.toLowerCase();
        return m.name.toLowerCase().includes(q) || m.phone.includes(q) || m.memberNumber.toLowerCase().includes(q);
    });

    // Group alphabetically
    const grouped = filteredMembers.reduce((acc: any, m: any) => {
        const letter = m.name.charAt(0).toUpperCase();
        if (!acc[letter]) acc[letter] = [];
        acc[letter].push(m);
        return acc;
    }, {});

    const sections = Object.keys(grouped).sort().map(letter => ({
        title: letter,
        data: grouped[letter]
    }));

    const getAvatarColors = (name: string): [string, string] => {
        const colors: [string, string][] = [
            ['#2ECC8A', '#1A6B47'], ['#4EA8F5', '#2563EB'], ['#F59E0B', '#D97706'],
            ['#EF4444', '#B91C1C'], ['#8B5CF6', '#6D28D9'], ['#EC4899', '#BE185D'],
            ['#06B6D4', '#0E7490'], ['#10B981', '#047857']
        ];
        const idx = name.charCodeAt(0) % colors.length;
        return colors[idx];
    };

    const goToTransact = (item: any) => {
        const firstAccount = item.accounts?.[0] || null;
        const route = mode === 'withdraw' ? '/withdraw' : '/deposit';
        router.push({
            pathname: route,
            params: { 
                assisted: 'true',
                memberId: item.memberId,
                userId: item.userId,
                memberName: item.name,
                memberImage: item.image || '',
                accountId: firstAccount?.id || '',
                accountName: firstAccount?.title || firstAccount?.name || firstAccount?.accountType || firstAccount?.type || '',
                accountNo: firstAccount?.accNo || firstAccount?.accountNo || firstAccount?.number || firstAccount?.accountNumber || '',
            }
        } as any);
    };

    return (
        <View className="flex-1 bg-warmWhite">
            <StatusBar style="light" />
            <Stack.Screen options={{ headerShown: false }} />

            {/* Header */}
            <View className="bg-forest pt-12 pb-8 overflow-hidden">
                <View className="absolute top-[-30px] right-[-30px] w-56 h-56 bg-mint/5 rounded-full" />
                
                <View className="px-6 flex-row justify-between items-center mb-6">
                    <View className="flex-row items-center">
                        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 bg-white/10 rounded-xl items-center justify-center mr-4 border border-white/20">
                            <IconSymbol name="chevron.left" size={20} color="white" />
                        </TouchableOpacity>
                        <View>
                            <Text className="text-white text-2xl font-black tracking-tight">Member{'\n'}Lookup</Text>
                            <Text className="text-white/50 text-xs font-medium mt-1">Search a member to transact</Text>
                        </View>
                    </View>
                    <View className="bg-white/15 border border-white/20 px-4 py-2 rounded-full">
                        <Text className="text-white text-xs font-black">{filteredMembers.length} results</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View className="px-6">
                    <View className="bg-white/10 border border-white/20 rounded-2xl px-5 h-14 flex-row items-center">
                        <IconSymbol name="magnifyingglass" size={18} color="rgba(255,255,255,0.5)" />
                        <TextInput 
                            className="flex-1 ml-3 text-white font-bold text-sm p-0"
                            placeholder="Search by name, ID, or phone..."
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={query}
                            onChangeText={setQuery}
                        />
                        {loading && <ActivityIndicator color="white" size="small" />}
                    </View>
                    <Text className="text-white/40 text-[10px] font-bold mt-2 px-1">
                        Type 2+ characters to search - only matching members are fetched
                    </Text>
                </View>
            </View>

            {/* Filter Chips */}
            <View className="px-5 py-4">
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {filters.map(f => (
                        <TouchableOpacity 
                            key={f}
                            onPress={() => setActiveFilter(f)}
                            className={`mr-3 px-5 py-2.5 rounded-full border ${activeFilter === f ? 'bg-leaf border-leaf' : 'bg-white border-gray-200'}`}
                        >
                            <Text className={`text-xs font-bold ${activeFilter === f ? 'text-white' : 'text-textDark'}`}>{f}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Member List */}
            {query.length < 2 ? (
                <View className="flex-1 items-center justify-center mt-20">
                    <View className="w-20 h-20 bg-gray-100 rounded-full items-center justify-center mb-4">
                        <IconSymbol name="magnifyingglass" size={32} color="#D1D5DB" />
                    </View>
                    <Text className="text-textLight text-xs font-bold">Start typing to find a member</Text>
                    <Text className="text-textLight text-[10px] text-center px-12 mt-1">We fetch only matches - not the whole directory.</Text>
                </View>
            ) : (
                <SectionList
                    sections={sections}
                    keyExtractor={(item) => item.memberId}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 120 }}
                    showsVerticalScrollIndicator={false}
                    stickySectionHeadersEnabled
                    renderSectionHeader={({ section }) => (
                        <View className="py-2 bg-warmWhite">
                            <Text className="text-textLight text-sm font-black">{section.title}</Text>
                        </View>
                    )}
                    ListEmptyComponent={() => (
                        <View className="items-center mt-20">
                            <View className="w-20 h-20 bg-gray-50 rounded-full items-center justify-center mb-4">
                                <IconSymbol name="person.fill.questionmark" size={32} color="#D1D5DB" />
                            </View>
                            <Text className="text-textDark font-black text-lg mb-1">No Members Found</Text>
                            <Text className="text-textLight text-xs text-center px-12">Try a different search term or filter.</Text>
                        </View>
                    )}
                    renderItem={({ item }) => {
                        const [color1, color2] = getAvatarColors(item.name);
                        const isActive = item.status?.toUpperCase() === 'ACTIVE';
                        const hasPhoto = !!item.image;

                        return (
                            <TouchableOpacity 
                                onPress={() => goToTransact(item)}
                                activeOpacity={0.7}
                                className="bg-white rounded-[24px] p-4 mb-3 flex-row items-center border border-gray-100 shadow-sm"
                            >
                                {/* Photo or initials avatar */}
                                <View className="w-14 h-14 rounded-2xl items-center justify-center mr-4 overflow-hidden" style={{ backgroundColor: color1 }}>
                                    {hasPhoto ? (
                                        <Image source={{ uri: item.image }} style={{ width: '100%', height: '100%' }} cachePolicy="memory-disk" transition={200} />
                                    ) : (
                                        <Text className="text-white font-black text-lg">{item.initials}</Text>
                                    )}
                                </View>

                                {/* Member Info */}
                                <View className="flex-1">
                                    <Text className="text-textDark font-black text-base tracking-tight">{item.name}</Text>
                                    <View className="flex-row items-center mt-1">
                                        <Text className="text-textLight text-[11px] font-bold">{item.memberNumber || 'N/A'}</Text>
                                        {item.zone ? (
                                            <View className="flex-row items-center ml-2">
                                                <Text className="text-[10px]">📍</Text>
                                                <Text className="text-textLight text-[10px] font-medium ml-0.5">{item.zone}</Text>
                                            </View>
                                        ) : null}
                                    </View>
                                </View>

                                {/* Right Side: Account Count + Status */}
                                <View className="items-end">
                                    {item.accountCount > 0 && (
                                        <View className="bg-leaf/10 px-3 py-1 rounded-full mb-1.5">
                                            <Text className="text-leaf text-[10px] font-black">{item.accountCount} acct{item.accountCount > 1 ? 's' : ''}</Text>
                                        </View>
                                    )}
                                    <View className={`px-3 py-1 rounded-full ${isActive ? 'bg-mint/10' : 'bg-red-50'}`}>
                                        <Text className={`text-[10px] font-black ${isActive ? 'text-mint' : 'text-red-400'}`}>
                                            {isActive ? 'Active' : 'Inactive'}
                                        </Text>
                                    </View>
                                </View>

                                <IconSymbol name="chevron.right" size={14} color="#D1D5DB" style={{ marginLeft: 8 }} />
                            </TouchableOpacity>
                        );
                    }}
                />
            )}
        </View>
    );
}
