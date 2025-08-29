'use client';

import { useState } from 'react';
import { Plus, Search, Trash2, Shield, ShieldOff, Filter, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useDomains, useAddDomain, useRemoveDomain, useBlockDomain, useBulkBlockDomains } from '@/hooks/useDns';
import { AddDomainSchema } from '@/types/dns';
import type { Domain, DNSFilter } from '@/types/dns';

export default function DomainManager() {
  const [filter, setFilter] = useState<DNSFilter>({ listType: 'all' });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDomains, setSelectedDomains] = useState<Set<string>>(new Set());
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newDomain, setNewDomain] = useState<{ domain: string; listType: 'black' | 'white'; comment: string }>({ domain: '', listType: 'black', comment: '' });

  const { data, isLoading, error } = useDomains(filter);
  const addDomain = useAddDomain();
  const removeDomain = useRemoveDomain();
  const blockDomain = useBlockDomain();
  const bulkBlock = useBulkBlockDomains();

  const domains = data?.data?.domains || [];
  const filteredDomains = domains.filter(domain => 
    !searchQuery || domain.domain.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddDomain = async () => {
    try {
      const validated = AddDomainSchema.parse(newDomain);
      await addDomain.mutateAsync(validated);
      setIsAddDialogOpen(false);
      setNewDomain({ domain: '', listType: 'black', comment: '' });
    } catch (error: any) {
      if (error.issues) {
        toast.error(error.issues[0].message);
      }
    }
  };

  const handleRemoveDomain = (domain: Domain) => {
    removeDomain.mutate({ 
      domain: domain.domain, 
      listType: domain.listType || (domain.blocked ? 'black' : 'white')
    });
  };

  const handleToggleBlock = (domain: Domain) => {
    blockDomain.mutate({ 
      domain: domain.domain, 
      block: !domain.blocked 
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedDomains(new Set(filteredDomains.map(d => d.domain)));
    } else {
      setSelectedDomains(new Set());
    }
  };

  const handleSelectDomain = (domain: string, checked: boolean) => {
    const newSelection = new Set(selectedDomains);
    if (checked) {
      newSelection.add(domain);
    } else {
      newSelection.delete(domain);
    }
    setSelectedDomains(newSelection);
  };

  const handleBulkAction = (action: 'block' | 'unblock' | 'delete') => {
    if (selectedDomains.size === 0) {
      toast.error('No domains selected');
      return;
    }

    const domainsArray = Array.from(selectedDomains);
    
    if (action === 'delete') {
      // TODO: Implement bulk delete
      toast.info('Bulk delete not yet implemented');
    } else {
      bulkBlock.mutate({ 
        domains: domainsArray, 
        block: action === 'block' 
      });
    }
    
    setSelectedDomains(new Set());
  };

  const exportDomains = () => {
    const csv = [
      ['Domain', 'Status', 'List Type', 'Comment'],
      ...filteredDomains.map(d => [
        d.domain,
        d.blocked ? 'Blocked' : 'Allowed',
        d.listType || (d.blocked ? 'black' : 'white'),
        d.comment || ''
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dns-domains-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Domain Management</CardTitle>
            <CardDescription>
              Manage blocked and allowed domains
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={exportDomains}>
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Domain
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Domain</DialogTitle>
                  <DialogDescription>
                    Add a new domain to the blocklist or allowlist
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="domain">Domain</Label>
                    <Input
                      id="domain"
                      placeholder="example.com"
                      value={newDomain.domain}
                      onChange={(e) => setNewDomain({ ...newDomain, domain: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="listType">List Type</Label>
                    <Select
                      value={newDomain.listType}
                      onValueChange={(value: 'black' | 'white') => 
                        setNewDomain({ ...newDomain, listType: value })
                      }
                    >
                      <SelectTrigger id="listType">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="black">Blocklist</SelectItem>
                        <SelectItem value="white">Allowlist</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comment">Comment (optional)</Label>
                    <Input
                      id="comment"
                      placeholder="Why is this domain being added?"
                      value={newDomain.comment}
                      onChange={(e) => setNewDomain({ ...newDomain, comment: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddDomain} disabled={addDomain.isPending}>
                    {addDomain.isPending ? 'Adding...' : 'Add Domain'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filters and Search */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search domains..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Select
            value={filter.listType || 'all'}
            onValueChange={(value) => 
              setFilter({ ...filter, listType: value as 'all' | 'black' | 'white' })
            }
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              <SelectItem value="black">Blocklist Only</SelectItem>
              <SelectItem value="white">Allowlist Only</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Bulk Actions */}
        {selectedDomains.size > 0 && (
          <div className="flex items-center justify-between bg-muted p-2 rounded-md">
            <span className="text-sm">
              {selectedDomains.size} domain{selectedDomains.size > 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkAction('block')}
              >
                Block Selected
              </Button>
              <Button 
                size="sm" 
                variant="outline"
                onClick={() => handleBulkAction('unblock')}
              >
                Unblock Selected
              </Button>
              <Button 
                size="sm" 
                variant="destructive"
                onClick={() => handleBulkAction('delete')}
              >
                Delete Selected
              </Button>
            </div>
          </div>
        )}

        {/* Domains Table */}
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-4 text-muted-foreground">
            Failed to load domains
          </div>
        ) : filteredDomains.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No domains found
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[50px]">
                    <Checkbox
                      checked={selectedDomains.size === filteredDomains.length && filteredDomains.length > 0}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Domain</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>List</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDomains.map((domain) => (
                  <TableRow key={domain.domain}>
                    <TableCell>
                      <Checkbox
                        checked={selectedDomains.has(domain.domain)}
                        onCheckedChange={(checked) => 
                          handleSelectDomain(domain.domain, checked as boolean)
                        }
                      />
                    </TableCell>
                    <TableCell className="font-medium">{domain.domain}</TableCell>
                    <TableCell>
                      <Badge variant={domain.blocked ? 'destructive' : 'default'}>
                        {domain.blocked ? (
                          <>
                            <ShieldOff className="mr-1 h-3 w-3" />
                            Blocked
                          </>
                        ) : (
                          <>
                            <Shield className="mr-1 h-3 w-3" />
                            Allowed
                          </>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {domain.listType || (domain.blocked ? 'Blocklist' : 'Allowlist')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Switch
                          checked={domain.blocked}
                          onCheckedChange={() => handleToggleBlock(domain)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveDomain(domain)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}