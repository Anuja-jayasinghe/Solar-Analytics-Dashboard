import React from "react";
import ReactDOM from "react-dom/client";
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import App from "./App";


ReactDOM.createRoot(document.getElementById("root")).render(
  <ChakraProvider value={defaultSystem}>
    <App />
  </ChakraProvider>
);
