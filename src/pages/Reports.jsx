import React from 'react';
import { Box, Heading, Text, VStack, Container, Flex, Icon } from '@chakra-ui/react';
import { FileText } from 'lucide-react';

const Reports = () => {
    return (
        <Container maxW="container.xl" p={0}>
            <Flex
                direction="column"
                align="center"
                justify="center"
                minH="60vh"
                textAlign="center"
                gap={6}
            >
                <Box
                    p={6}
                    bg="var(--card-bg-solid)"
                    borderRadius="full"
                    boxShadow="lg"
                    border="1px solid var(--card-border)"
                >
                    <Icon as={FileText} w={12} h={12} color="var(--accent)" />
                </Box>

                <VStack spacing={4}>
                    <Heading
                        size="xl"
                        bgGradient="linear(to-r, var(--accent), cyan.400)"
                        bgClip="text"
                        fontWeight="extrabold"
                    >
                        Reports & Analytics
                    </Heading>

                    <Text fontSize="lg" color="var(--text-secondary)" maxW="md">
                        Detailed generation reports and exportable analytics are coming soon.
                    </Text>
                </VStack>
            </Flex>
        </Container>
    );
};

export default Reports;
