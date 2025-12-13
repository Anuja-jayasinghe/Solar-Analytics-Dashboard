import { useState, useCallback } from 'react';

/**
 * useTablePagination Hook
 * Manages pagination state for data tables
 * 
 * Usage:
 * const { currentPage, itemsPerPage, paginate, setItemsPerPage, paginatedData } = useTablePagination(allData, 20);
 */
export default function useTablePagination(data = [], initialItemsPerPage = 20) {
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(initialItemsPerPage);

  // Calculate pagination values
  const totalItems = data.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedData = data.slice(startIndex, endIndex);

  // Handle page changes
  const paginate = useCallback((page) => {
    const pageNum = Math.max(1, Math.min(page, totalPages));
    setCurrentPage(pageNum);
  }, [totalPages]);

  // Reset to page 1 when itemsPerPage changes
  const updateItemsPerPage = useCallback((newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  }, []);

  return {
    currentPage,
    itemsPerPage,
    totalItems,
    totalPages,
    paginatedData,
    paginate,
    setItemsPerPage: updateItemsPerPage,
    startIndex,
    endIndex,
  };
}
